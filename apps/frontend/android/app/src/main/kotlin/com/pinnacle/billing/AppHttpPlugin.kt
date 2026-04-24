package com.pinnacle.billing

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.Dns
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.dnsoverhttps.DnsOverHttps
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.ConnectException
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLException
import javax.net.ssl.SSLHandshakeException

@CapacitorPlugin(name = "AppHttp")
class AppHttpPlugin : Plugin() {
    private lateinit var cookieJar: PersistentCookieJar
    private lateinit var dnsCache: BackendDnsCache
    private lateinit var bootstrapClient: OkHttpClient
    private lateinit var defaultClient: OkHttpClient
    private val dnsClientsByHost = ConcurrentHashMap<String, OkHttpClient>()

    override fun load() {
        super.load()

        cookieJar = PersistentCookieJar(context)
        dnsCache = BackendDnsCache(context)
        bootstrapClient = OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()
        defaultClient = createBaseClientBuilder()
            .build()
    }

    @PluginMethod
    fun execute(call: PluginCall) {
        val urlValue = call.getString("url")?.trim().orEmpty()
        if (urlValue.isEmpty()) {
            call.reject("Request URL is required", "invalid_request")
            return
        }

        val url = try {
            urlValue.toHttpUrl()
        } catch (_: IllegalArgumentException) {
            call.reject("Invalid request URL", "invalid_request")
            return
        }

        val method = call.getString("method", "GET")!!.uppercase()
        val headers = call.getObject("headers", JSObject()) ?: JSObject()
        val bodyText = call.getString("bodyText")
        val dnsHost = call.getString("dnsHost")
            ?.trim()
            ?.lowercase()
            ?.takeIf { it.isNotEmpty() }

        val request = try {
            buildRequest(url, method, headers, bodyText)
        } catch (error: IllegalArgumentException) {
            call.reject(error.message ?: "Invalid request body", "invalid_request")
            return
        }

        val client = clientFor(url, dnsHost)
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(okCall: Call, e: IOException) {
                val errorType = when {
                    okCall.isCanceled() -> "cancelled"
                    isOffline() -> "offline"
                    e is UnknownHostException -> "dns_failure"
                    e is SocketTimeoutException -> "timeout"
                    e is ConnectException -> "connection_failure"
                    e is SSLHandshakeException || e is SSLException -> "tls_failure"
                    else -> "connection_failure"
                }
                val data = JSObject()
                data.put("errorType", errorType)
                bridge.executeOnMainThread {
                    call.reject(
                        e.localizedMessage ?: "Native HTTP request failed",
                        errorType,
                        e,
                        data,
                    )
                }
            }

            override fun onResponse(okCall: Call, response: Response) {
                response.use {
                    val payload = JSObject()
                    payload.put("status", response.code)
                    payload.put("headers", headersToJsObject(response))
                    payload.put("bodyText", response.body?.string().orEmpty())
                    bridge.executeOnMainThread {
                        call.resolve(payload)
                    }
                }
            }
        })
    }

    private fun clientFor(url: HttpUrl, dnsHost: String?): OkHttpClient {
        val host = dnsHost ?: return defaultClient
        if (!url.host.equals(host, ignoreCase = true)) {
            return defaultClient
        }

        return dnsClientsByHost.computeIfAbsent(host) { matchedHost ->
            createBaseClientBuilder()
                .dns(BackendAwareDns(matchedHost, bootstrapClient, dnsCache))
                .build()
        }
    }

    private fun createBaseClientBuilder(): OkHttpClient.Builder =
        OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)

    private fun buildRequest(
        url: HttpUrl,
        method: String,
        headers: JSObject,
        bodyText: String?,
    ): Request {
        val requestBuilder = Request.Builder().url(url)
        headers.keys().forEach { key ->
            val value = headers.optString(key, null)
            if (!value.isNullOrEmpty()) {
                requestBuilder.addHeader(key, value)
            }
        }

        requestBuilder.method(method, buildRequestBody(method, headers, bodyText))
        return requestBuilder.build()
    }

    private fun buildRequestBody(
        method: String,
        headers: JSObject,
        bodyText: String?,
    ): RequestBody? {
        if (method == "GET" || method == "HEAD") {
            return null
        }

        val contentType = headers.optString("Content-Type")
            .ifEmpty { headers.optString("content-type") }
            .takeIf { it.isNotEmpty() }
            ?.toMediaTypeOrNull()

        return (bodyText ?: "").toRequestBody(contentType)
    }

    private fun headersToJsObject(response: Response): JSObject {
        val headers = JSObject()
        response.headers.names().forEach { name ->
            headers.put(name, response.headers(name).joinToString(", "))
        }
        return headers
    }

    private fun isOffline(): Boolean {
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return false
        val network = connectivityManager.activeNetwork ?: return true
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return true
        return !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    companion object {
        private const val CONNECT_TIMEOUT_SECONDS = 15L
        private const val READ_TIMEOUT_SECONDS = 30L
        private const val WRITE_TIMEOUT_SECONDS = 30L
    }
}

private class BackendAwareDns(
    private val backendHost: String,
    bootstrapClient: OkHttpClient,
    private val cache: BackendDnsCache,
) : Dns {
    private val cloudflareDns = DnsOverHttps.Builder()
        .client(bootstrapClient)
        .url("https://cloudflare-dns.com/dns-query".toHttpUrl())
        .bootstrapDnsHosts(
            listOf(
                InetAddress.getByName("1.1.1.1"),
                InetAddress.getByName("1.0.0.1"),
            ),
        )
        .build()

    private val googleDns = DnsOverHttps.Builder()
        .client(bootstrapClient)
        .url("https://dns.google/dns-query".toHttpUrl())
        .bootstrapDnsHosts(
            listOf(
                InetAddress.getByName("8.8.8.8"),
                InetAddress.getByName("8.8.4.4"),
            ),
        )
        .build()

    override fun lookup(hostname: String): List<InetAddress> {
        if (!hostname.equals(backendHost, ignoreCase = true)) {
            return Dns.SYSTEM.lookup(hostname)
        }

        cache.getFresh(hostname)?.let { return it }

        val resolvers = listOf(cloudflareDns, googleDns)
        for (resolver in resolvers) {
            try {
                val result = resolver.lookup(hostname)
                cache.save(hostname, result)
                return result
            } catch (_: IOException) {
            }
        }

        try {
            val result = Dns.SYSTEM.lookup(hostname)
            cache.save(hostname, result)
            return result
        } catch (systemError: UnknownHostException) {
            cache.getStale(hostname)?.let { return it }
            throw systemError
        }
    }
}

private class BackendDnsCache(context: Context) {
    private val preferences =
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    fun getFresh(hostname: String): List<InetAddress>? {
        return get(hostname, includeStale = false)
    }

    @Synchronized
    fun getStale(hostname: String): List<InetAddress>? {
        return get(hostname, includeStale = true)
    }

    @Synchronized
    fun save(hostname: String, addresses: List<InetAddress>) {
        if (addresses.isEmpty()) {
            return
        }

        val now = System.currentTimeMillis()
        val payload = JSONObject()
        val values = JSONArray()
        addresses.forEach { address ->
            values.put(address.hostAddress)
        }
        payload.put("addresses", values)
        payload.put("freshUntilMs", now + FRESH_WINDOW_MS)
        payload.put("staleUntilMs", now + STALE_IF_ERROR_WINDOW_MS)
        preferences.edit().putString(hostname.lowercase(), payload.toString()).apply()
    }

    private fun get(hostname: String, includeStale: Boolean): List<InetAddress>? {
        val raw = preferences.getString(hostname.lowercase(), null) ?: return null
        val now = System.currentTimeMillis()
        val parsed = try {
            JSONObject(raw)
        } catch (_: Exception) {
            preferences.edit().remove(hostname.lowercase()).apply()
            return null
        }

        val freshUntilMs = parsed.optLong("freshUntilMs", 0L)
        val staleUntilMs = parsed.optLong("staleUntilMs", 0L)
        val validUntil = if (includeStale) staleUntilMs else freshUntilMs
        if (now > validUntil) {
            if (now > staleUntilMs) {
                preferences.edit().remove(hostname.lowercase()).apply()
            }
            return null
        }

        val addresses = parsed.optJSONArray("addresses") ?: return null
        val resolved = buildList {
            for (index in 0 until addresses.length()) {
                val hostAddress = addresses.optString(index)
                if (hostAddress.isNotEmpty()) {
                    add(InetAddress.getByName(hostAddress))
                }
            }
        }
        return resolved.ifEmpty { null }
    }

    companion object {
        private const val PREFERENCES_NAME = "app_http_dns_cache"
        private val FRESH_WINDOW_MS = TimeUnit.MINUTES.toMillis(10)
        private val STALE_IF_ERROR_WINDOW_MS = TimeUnit.DAYS.toMillis(1)
    }
}

private class PersistentCookieJar(context: Context) : CookieJar {
    private val preferences =
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val cache = linkedMapOf<String, Cookie>()

    init {
        loadPersistedCookies()
    }

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        cleanupExpired()
        cookies.forEach { cookie ->
            val key = keyFor(cookie)
            if (cookie.expiresAt < System.currentTimeMillis()) {
                cache.remove(key)
            } else {
                cache[key] = cookie
            }
        }
        persist()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        cleanupExpired()
        return cache.values.filter { it.matches(url) }
    }

    private fun loadPersistedCookies() {
        val raw = preferences.getString(COOKIES_KEY, null) ?: return
        val entries = try {
            JSONArray(raw)
        } catch (_: Exception) {
            preferences.edit().remove(COOKIES_KEY).apply()
            return
        }

        for (index in 0 until entries.length()) {
            val entry = entries.optJSONObject(index) ?: continue
            deserializeCookie(entry)?.let { cookie ->
                if (cookie.expiresAt >= System.currentTimeMillis()) {
                    cache[keyFor(cookie)] = cookie
                }
            }
        }
    }

    private fun persist() {
        val now = System.currentTimeMillis()
        val serialized = JSONArray()
        cache.values.forEach { cookie ->
            if (cookie.persistent && cookie.expiresAt >= now) {
                serialized.put(serializeCookie(cookie))
            }
        }
        preferences.edit().putString(COOKIES_KEY, serialized.toString()).apply()
    }

    private fun cleanupExpired() {
        val now = System.currentTimeMillis()
        val iterator = cache.entries.iterator()
        while (iterator.hasNext()) {
            if (iterator.next().value.expiresAt < now) {
                iterator.remove()
            }
        }
    }

    private fun serializeCookie(cookie: Cookie): JSONObject {
        val payload = JSONObject()
        payload.put("name", cookie.name)
        payload.put("value", cookie.value)
        payload.put("expiresAt", cookie.expiresAt)
        payload.put("domain", cookie.domain)
        payload.put("path", cookie.path)
        payload.put("secure", cookie.secure)
        payload.put("httpOnly", cookie.httpOnly)
        payload.put("hostOnly", cookie.hostOnly)
        payload.put("persistent", cookie.persistent)
        return payload
    }

    private fun deserializeCookie(payload: JSONObject): Cookie? {
        val name = payload.optString("name")
        val value = payload.optString("value")
        val domain = payload.optString("domain")
        if (name.isEmpty() || domain.isEmpty()) {
            return null
        }

        val builder = Cookie.Builder()
            .name(name)
            .value(value)
            .path(payload.optString("path", "/"))

        if (payload.optBoolean("hostOnly", false)) {
            builder.hostOnlyDomain(domain)
        } else {
            builder.domain(domain)
        }

        if (payload.optBoolean("persistent", false)) {
            builder.expiresAt(payload.optLong("expiresAt"))
        }
        if (payload.optBoolean("secure", false)) {
            builder.secure()
        }
        if (payload.optBoolean("httpOnly", false)) {
            builder.httpOnly()
        }

        return try {
            builder.build()
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun keyFor(cookie: Cookie): String =
        listOf(cookie.name, cookie.domain, cookie.path, cookie.secure.toString())
            .joinToString("|")

    companion object {
        private const val PREFERENCES_NAME = "app_http_cookies"
        private const val COOKIES_KEY = "cookies"
    }
}
