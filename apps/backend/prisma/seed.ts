import * as argon2 from "argon2";
import { prisma } from "../src/lib/prisma.js";

const ADMIN_PHONE = "1234567890";
const ADMIN_EMAIL = "admin@mystore.com";
const ADMIN_PASSWORD = "admin";
const STORE_OWNER_PHONE = "9876501234";
const STORE_OWNER_EMAIL = "owner@sunrisetraders.com";
const STORE_OWNER_PASSWORD = "owner123";

const SUNRISE_TRADERS = {
  name: "Sunrise Traders",
  phoneNumber: "9876543210",
  email: "sunrise.traders@example.com",
  businessType: "retail",
  businessCategory: "Fruits & Vegetables",
  state: "Tamil Nadu",
  pincode: "643001",
  address: "12 Market Yard Road, Ooty",
  bundleKey: "TRADING" as const,
  priceBookCode: "DEFAULT",
  priceBookName: "Default Price Book",
  testParty: {
    name: "Sunrise Test Party",
    phone: "9000000001",
    email: "testparty@sunrisetraders.com",
    address: "24 Wholesale Lane, Ooty",
    gstNo: "33ABCDE1234F1Z5",
  },
  itemName: "Apple",
  itemCategory: "Fruits & Vegetables",
  hsnSac: "08081000",
  unit: "KG" as const,
  varietyOptionName: "Variety",
  variants: [
    {
      value: "Ooty",
      sku: "APL-OOTY",
      salesPrice: "180.00",
      purchasePrice: "140.00",
      gstSlab: "5%",
    },
    {
      value: "Himachal",
      sku: "APL-HIMACHAL",
      salesPrice: "210.00",
      purchasePrice: "165.00",
      gstSlab: "5%",
    },
    {
      value: "Kashmir",
      sku: "APL-KASHMIR",
      salesPrice: "240.00",
      purchasePrice: "195.00",
      gstSlab: "5%",
    },
  ],
};

const toUtcDate = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));

const toDeletedAtValue = (value: Date | null | undefined) => value?.toISOString() ?? null;

const buildItemPriceEntityId = (variantId: string, priceType: "SALES" | "PURCHASE") =>
  `${variantId}:${priceType}`;

const syncSeededParty = async (tenantId: string, partyId: string) => {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
  });

  if (!party) {
    return;
  }

  const snapshot = {
    id: party.id,
    businessId: party.business_id,
    name: party.name,
    phone: party.phone ?? null,
    email: party.email ?? null,
    address: party.address ?? null,
    gstNo: party.tax_id ?? null,
    type: party.type,
    isActive: party.is_active ?? true,
    deletedAt: toDeletedAtValue(party.deleted_at),
    createdAt: party.created_at.toISOString(),
    updatedAt: party.updated_at.toISOString(),
  };

  await appendSyncChange(tenantId, "customer", party.id, snapshot);
  await appendSyncChange(tenantId, "supplier", party.id, snapshot);
};

const appendSyncChange = async (
  tenantId: string,
  entity: string,
  entityId: string,
  data: Record<string, unknown>,
) => {
  const latest = await prisma.syncChangeLog.findFirst({
    where: {
      tenant_id: tenantId,
      entity,
      entity_id: entityId,
    },
    orderBy: {
      server_version: "desc",
    },
    select: {
      server_version: true,
    },
  });

  await prisma.syncChangeLog.create({
    data: {
      tenant_id: tenantId,
      entity,
      entity_id: entityId,
      operation: "UPDATE",
      data,
      server_version: (latest?.server_version ?? 0) + 1,
    },
  });
};

const syncSeededCatalog = async (tenantId: string, itemId: string) => {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      variants: {
        where: {
          deleted_at: null,
        },
        include: {
          option_values: {
            include: {
              option_value: {
                include: {
                  option: true,
                },
              },
            },
          },
        },
        orderBy: [
          { is_default: "desc" },
          { name: "asc" },
          { id: "asc" },
        ],
      },
    },
  });

  if (!item) {
    return;
  }

  const variantOptionMap = new Map<string, Record<string, string>>();
  for (const variant of item.variants) {
    const optionValues = Object.fromEntries(
      variant.option_values
        .map((entry) => [
          entry.option_value.option.name.trim(),
          entry.option_value.value.trim(),
        ])
        .filter(([key, value]) => key.length > 0 && value.length > 0),
    );
    variantOptionMap.set(variant.id, optionValues);
  }

  const variantSnapshots = item.variants.map((variant) => ({
    id: variant.id,
    itemId: variant.item_id,
    businessId: variant.business_id,
    sku: variant.sku ?? null,
    barcode: variant.barcode ?? null,
    name: variant.name ?? null,
    metadata: variant.metadata ?? null,
    isDefault: variant.is_default,
    isActive: variant.is_active,
    deletedAt: toDeletedAtValue(variant.deleted_at),
    optionValues: variantOptionMap.get(variant.id) ?? {},
    usageCount: 0,
    isLocked: false,
  }));

  const defaultVariant = item.variants.find((variant) => variant.is_default) ?? item.variants[0] ?? null;

  await appendSyncChange(tenantId, "item", item.id, {
    id: item.id,
    businessId: item.business_id,
    itemType: item.item_type,
    name: item.name,
    hsnSac: item.hsn_sac ?? null,
    category: item.category ?? null,
    unit: item.unit,
    sku: defaultVariant?.sku ?? null,
    defaultVariantId: defaultVariant?.id ?? null,
    metadata: item.metadata ?? null,
    isActive: item.is_active ?? true,
    deletedAt: toDeletedAtValue(item.deleted_at),
    variants: variantSnapshots,
    variantCount: variantSnapshots.length,
  });

  for (const variant of item.variants) {
    await appendSyncChange(tenantId, "item_variant", variant.id, {
      id: variant.id,
      itemId: variant.item_id,
      businessId: variant.business_id,
      sku: variant.sku ?? null,
      barcode: variant.barcode ?? null,
      name: variant.name ?? null,
      metadata: variant.metadata ?? null,
      isDefault: variant.is_default,
      isActive: variant.is_active,
      deletedAt: toDeletedAtValue(variant.deleted_at),
      optionValues: variantOptionMap.get(variant.id) ?? {},
      usageCount: 0,
      isLocked: false,
    });

    const prices = await prisma.itemPrice.findMany({
      where: {
        business_id: tenantId,
        variant_id: variant.id,
        deleted_at: null,
        customer_group_id: null,
        min_qty: 1,
        max_qty: null,
      },
      include: {
        price_book: true,
      },
    });

    for (const price of prices) {
      await appendSyncChange(tenantId, "item_price", buildItemPriceEntityId(variant.id, price.price_type), {
        variantId: variant.id,
        itemId: variant.item_id,
        itemName: item.name,
        itemCategory: item.category ?? "",
        variantName: variant.name ?? "",
        sku: variant.sku ?? "",
        isDefaultVariant: Boolean(variant.is_default),
        isActive: Boolean(variant.is_active && price.is_active && !price.deleted_at),
        deletedAt: toDeletedAtValue(price.deleted_at),
        amount: Number(price.amount),
        currency: price.currency,
        priceType: price.price_type,
        taxMode: price.tax_mode,
        gstSlab: price.gst_slab ?? null,
        updatedAt: price.updated_at.toISOString(),
      });
    }
  }
};

const seed = async () => {
  const [adminPasswordHash, storeOwnerPasswordHash] = await Promise.all([
    argon2.hash(ADMIN_PASSWORD),
    argon2.hash(STORE_OWNER_PASSWORD),
  ]);

  const superAdmin = await prisma.identity.upsert({
    where: { phone: ADMIN_PHONE },
    update: {
      email: ADMIN_EMAIL,
      password_hash: adminPasswordHash,
      system_role: "PLATFORM_ADMIN",
    },
    create: {
      name: "Admin User",
      phone: ADMIN_PHONE,
      email: ADMIN_EMAIL,
      password_hash: adminPasswordHash,
      system_role: "PLATFORM_ADMIN",
    },
  });

  const storeOwner = await prisma.identity.upsert({
    where: { phone: STORE_OWNER_PHONE },
    update: {
      name: "Sunrise Owner",
      email: STORE_OWNER_EMAIL,
      password_hash: storeOwnerPasswordHash,
      system_role: "USER",
      deleted_at: null,
    },
    create: {
      name: "Sunrise Owner",
      phone: STORE_OWNER_PHONE,
      email: STORE_OWNER_EMAIL,
      password_hash: storeOwnerPasswordHash,
      system_role: "USER",
    },
  });

  const business =
    (await prisma.business.findFirst({
      where: {
        name: SUNRISE_TRADERS.name,
      },
    })) ??
    (await prisma.business.create({
      data: {
        name: SUNRISE_TRADERS.name,
        owner_id: storeOwner.id,
        phone_number: SUNRISE_TRADERS.phoneNumber,
        email: SUNRISE_TRADERS.email,
        business_type: SUNRISE_TRADERS.businessType,
        business_category: SUNRISE_TRADERS.businessCategory,
        state: SUNRISE_TRADERS.state,
        pincode: SUNRISE_TRADERS.pincode,
        address: SUNRISE_TRADERS.address,
      },
    }));

  await prisma.business.update({
    where: { id: business.id },
    data: {
      owner_id: storeOwner.id,
      phone_number: SUNRISE_TRADERS.phoneNumber,
      email: SUNRISE_TRADERS.email,
      business_type: SUNRISE_TRADERS.businessType,
      business_category: SUNRISE_TRADERS.businessCategory,
      state: SUNRISE_TRADERS.state,
      pincode: SUNRISE_TRADERS.pincode,
      address: SUNRISE_TRADERS.address,
      deleted_at: null,
    },
  });

  await prisma.businessMember.upsert({
    where: {
      business_id_identity_id: {
        business_id: business.id,
        identity_id: storeOwner.id,
      },
    },
    update: {
      role: "OWNER",
    },
    create: {
      business_id: business.id,
      identity_id: storeOwner.id,
      role: "OWNER",
    },
  });

  await prisma.businessMember.upsert({
    where: {
      business_id_identity_id: {
        business_id: business.id,
        identity_id: superAdmin.id,
      },
    },
    update: {
      role: "MANAGER",
    },
    create: {
      business_id: business.id,
      identity_id: superAdmin.id,
      role: "MANAGER",
    },
  });

  const activeLicense = await prisma.businessLicense.findFirst({
    where: {
      business_id: business.id,
      status: "ACTIVE",
    },
    orderBy: {
      version: "desc",
    },
  });

  if (activeLicense) {
    await prisma.businessLicense.update({
      where: { id: activeLicense.id },
      data: {
        begins_at: toUtcDate(2026, 0, 1),
        ends_at: toUtcDate(2027, 0, 1),
        bundle_key: SUNRISE_TRADERS.bundleKey,
        add_on_capability_keys: [],
        removed_capability_keys: [],
        user_limit_type: null,
        user_limit_value: null,
      },
    });
  } else {
    await prisma.businessLicense.create({
      data: {
        business_id: business.id,
        version: 1,
        status: "ACTIVE",
        begins_at: toUtcDate(2026, 0, 1),
        ends_at: toUtcDate(2027, 0, 1),
        bundle_key: SUNRISE_TRADERS.bundleKey,
        add_on_capability_keys: [],
        removed_capability_keys: [],
      },
    });
  }

  const priceBook = await prisma.priceBook.upsert({
    where: {
      business_id_code: {
        business_id: business.id,
        code: SUNRISE_TRADERS.priceBookCode,
      },
    },
    update: {
      name: SUNRISE_TRADERS.priceBookName,
      default_currency: "INR",
      is_default: true,
      is_active: true,
      priority: 0,
    },
    create: {
      business_id: business.id,
      code: SUNRISE_TRADERS.priceBookCode,
      name: SUNRISE_TRADERS.priceBookName,
      default_currency: "INR",
      is_default: true,
      is_active: true,
      priority: 0,
    },
  });

  const sunriseTestParty =
    (await prisma.party.findFirst({
      where: {
        business_id: business.id,
        name: SUNRISE_TRADERS.testParty.name,
      },
    })) ??
    (await prisma.party.create({
      data: {
        business_id: business.id,
        name: SUNRISE_TRADERS.testParty.name,
        phone: SUNRISE_TRADERS.testParty.phone,
        email: SUNRISE_TRADERS.testParty.email,
        address: SUNRISE_TRADERS.testParty.address,
        tax_id: SUNRISE_TRADERS.testParty.gstNo,
        type: "BOTH",
        is_active: true,
      },
    }));

  await prisma.party.update({
    where: { id: sunriseTestParty.id },
    data: {
      phone: SUNRISE_TRADERS.testParty.phone,
      email: SUNRISE_TRADERS.testParty.email,
      address: SUNRISE_TRADERS.testParty.address,
      tax_id: SUNRISE_TRADERS.testParty.gstNo,
      type: "BOTH",
      is_active: true,
      deleted_at: null,
    },
  });

  await syncSeededParty(business.id, sunriseTestParty.id);

  const appleItem =
    (await prisma.item.findFirst({
      where: {
        business_id: business.id,
        name: SUNRISE_TRADERS.itemName,
        deleted_at: null,
      },
    })) ??
    (await prisma.item.create({
      data: {
        business_id: business.id,
        item_type: "PRODUCT",
        name: SUNRISE_TRADERS.itemName,
        hsn_sac: SUNRISE_TRADERS.hsnSac,
        category: SUNRISE_TRADERS.itemCategory,
        unit: SUNRISE_TRADERS.unit,
        is_active: true,
      },
    }));

  await prisma.item.update({
    where: { id: appleItem.id },
    data: {
      item_type: "PRODUCT",
      hsn_sac: SUNRISE_TRADERS.hsnSac,
      category: SUNRISE_TRADERS.itemCategory,
      unit: SUNRISE_TRADERS.unit,
      is_active: true,
      deleted_at: null,
    },
  });

  const varietyOption =
    (await prisma.itemOption.findFirst({
      where: {
        item_id: appleItem.id,
        name: SUNRISE_TRADERS.varietyOptionName,
      },
    })) ??
    (await prisma.itemOption.create({
      data: {
        item_id: appleItem.id,
        name: SUNRISE_TRADERS.varietyOptionName,
        position: 0,
      },
    }));

  for (const [index, variantSeed] of SUNRISE_TRADERS.variants.entries()) {
    const optionValue =
      (await prisma.itemOptionValue.findFirst({
        where: {
          option_id: varietyOption.id,
          value: variantSeed.value,
        },
      })) ??
      (await prisma.itemOptionValue.create({
        data: {
          option_id: varietyOption.id,
          value: variantSeed.value,
          position: index,
        },
      }));

    const variantName = `${SUNRISE_TRADERS.itemName} - ${variantSeed.value}`;
    const variant =
      (await prisma.itemVariant.findFirst({
        where: {
          business_id: business.id,
          item_id: appleItem.id,
          sku: variantSeed.sku,
        },
      })) ??
      (await prisma.itemVariant.create({
        data: {
          business_id: business.id,
          item_id: appleItem.id,
          sku: variantSeed.sku,
          name: variantName,
          is_default: index === 0,
          is_active: true,
        },
      }));

    await prisma.itemVariant.update({
      where: { id: variant.id },
      data: {
        name: variantName,
        sku: variantSeed.sku,
        is_default: index === 0,
        is_active: true,
        deleted_at: null,
      },
    });

    await prisma.itemVariantOptionValue.upsert({
      where: {
        variant_id_option_value_id: {
          variant_id: variant.id,
          option_value_id: optionValue.id,
        },
      },
      update: {},
      create: {
        variant_id: variant.id,
        option_value_id: optionValue.id,
      },
    });

    for (const priceType of ["SALES", "PURCHASE"] as const) {
      const amount = priceType === "SALES" ? variantSeed.salesPrice : variantSeed.purchasePrice;

      const existingPrice = await prisma.itemPrice.findFirst({
        where: {
          business_id: business.id,
          price_book_id: priceBook.id,
          variant_id: variant.id,
          customer_group_id: null,
          min_qty: 1,
          max_qty: null,
          price_type: priceType,
          deleted_at: null,
        },
      });

      if (existingPrice) {
        await prisma.itemPrice.update({
          where: { id: existingPrice.id },
          data: {
            amount,
            currency: "INR",
            tax_mode: "EXCLUSIVE",
            gst_slab: variantSeed.gstSlab,
            is_active: true,
            deleted_at: null,
            starts_at: null,
            ends_at: null,
            priority: 0,
          },
        });
      } else {
        await prisma.itemPrice.create({
          data: {
            business_id: business.id,
            price_book_id: priceBook.id,
            variant_id: variant.id,
            customer_group_id: null,
            min_qty: 1,
            max_qty: null,
            amount,
            currency: "INR",
            price_type: priceType,
            tax_mode: "EXCLUSIVE",
            gst_slab: variantSeed.gstSlab,
            is_active: true,
            priority: 0,
          },
        });
      }
    }
  }

  await syncSeededCatalog(business.id, appleItem.id);

  console.log("Super admin seeded:", {
    phone: ADMIN_PHONE,
    password: ADMIN_PASSWORD,
  });
  console.log("Store owner seeded:", {
    phone: STORE_OWNER_PHONE,
    password: STORE_OWNER_PASSWORD,
  });
  console.log("Business seeded:", SUNRISE_TRADERS.name);
  console.log("Test party seeded:", SUNRISE_TRADERS.testParty.name);
  console.log(
    "Apple variants seeded:",
    SUNRISE_TRADERS.variants.map((variant) => variant.value).join(", "),
  );
};

try {
  await seed();
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
