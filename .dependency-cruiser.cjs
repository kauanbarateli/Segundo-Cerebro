module.exports = {
  forbidden: [
    {
      name: "core-is-pure",
      severity: "error",
      comment: "ADR-0002: o Núcleo só conhece regras e contratos do próprio Núcleo.",
      from: { path: "(?:^|/)src/core/" },
      to: { pathNot: "(?:^|/)src/core/" },
    },
    {
      name: "ui-does-not-import-features",
      severity: "error",
      from: { path: "(?:^|/)src/components/ui/" },
      to: { path: "(?:^|/)src/components/features/" },
    },
    {
      name: "features-are-independent",
      severity: "error",
      from: { path: "(?:^|/)src/components/features/([^/]+)/" },
      to: { path: "(?:^|/)src/components/features/", pathNot: "(?:^|/)src/components/features/$1/" },
    },
    {
      name: "database-only-at-server-boundary",
      severity: "error",
      comment: "Leituras RSC e composição de Actions/rotas podem ligar adapters; componentes não.",
      from: { pathNot: [
        "(?:^|/)src/adapters/db/",
        "(?:^|/)src/app/(?:page|layout|actions|route)\\.tsx?$",
        "(?:^|/)src/app/.+/(?:page|layout|actions|route)\\.tsx?$",
      ] },
      to: { path: "(?:^|/)src/adapters/db/" },
    },
    { name: "no-circular-dependencies", severity: "error", from: {}, to: { circular: true } },
    { name: "no-unresolved-imports", severity: "error", from: {}, to: { couldNotResolve: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
