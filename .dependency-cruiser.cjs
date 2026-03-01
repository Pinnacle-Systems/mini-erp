/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies obscure module boundaries and make architectural drift harder to reason about.",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "frontend-features-must-not-import-pages",
      severity: "error",
      comment: "Feature logic should stay reusable and must not depend on route/page implementations.",
      from: {
        path: "^apps/frontend/src/features/",
      },
      to: {
        path: "^apps/frontend/src/pages/",
      },
    },
    {
      name: "frontend-lib-must-stay-foundational",
      severity: "error",
      comment: "Shared frontend lib code should not depend on app-layer UI or feature modules.",
      from: {
        path: "^apps/frontend/src/lib/",
      },
      to: {
        path: "^apps/frontend/src/(design-system|features|pages|routes)/",
      },
    },
    {
      name: "frontend-atoms-and-molecules-must-stay-foundational",
      severity: "error",
      comment: "Low-level design-system building blocks should not depend on pages, routes, or feature state.",
      from: {
        path: "^apps/frontend/src/design-system/(atoms|molecules)/",
      },
      to: {
        path: "^apps/frontend/src/(features|pages|routes)/",
      },
    },
    {
      name: "backend-shared-utils-must-not-import-modules",
      severity: "error",
      comment: "Shared backend utilities should remain generic and avoid pulling in domain modules.",
      from: {
        path: "^apps/backend/src/shared/utils/",
      },
      to: {
        path: "^apps/backend/src/modules/",
      },
    },
    {
      name: "backend-shared-middleware-must-use-module-public-entrypoints",
      severity: "error",
      comment: "Shared middleware may depend on modules only through explicit *.public.ts entrypoints.",
      from: {
        path: "^apps/backend/src/shared/middleware/",
      },
      to: {
        path: "^apps/backend/src/modules/.+/(?!.+\\.public\\.ts$).+\\.ts$",
      },
    },
    {
      name: "backend-lib-must-stay-foundational",
      severity: "error",
      comment: "Backend lib helpers should stay below domain modules in the dependency graph.",
      from: {
        path: "^apps/backend/src/lib/",
      },
      to: {
        path: "^apps/backend/src/(modules|shared)/",
      },
    },
  ],
  options: {
    includeOnly: "^apps/(frontend|backend)/src/",
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
      },
    },
  },
};
