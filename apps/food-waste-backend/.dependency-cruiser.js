/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'warn',
      comment:
        'This dependency is part of a circular relationship. You might want to revise ' +
        'your solution (i.e. use dependency inversion, make sure the modules have a single responsibility) ',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-orphans',
      comment:
        "This is an orphan module - it's likely not used (anymore?). Either use it or " +
        "remove it. If it's logical this module is an orphan (i.e. it's a config file), " +
        'add an exception for it in your dependency-cruiser configuration.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$', // dot files
          '\\.d\\.ts$', // TypeScript declaration files
          '(^|/)tsconfig\\.json$', // TypeScript configs
          '(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts|json)$', // build tool configs
          '^src/main\\.ts$', // entry point
          '^test/', // test files
        ],
      },
      to: {},
    },
    {
      name: 'no-deprecated-core',
      comment:
        'A module depends on a node core module that has been deprecated. Find an alternative - these are ' +
        "bound to exist - node doesn't deprecate lightly.",
      severity: 'warn',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: [
          '^(v8/tools/codemap)$',
          '^(v8/tools/consarray)$',
          '^(v8/tools/csvparser)$',
          '^(v8/tools/logreader)$',
          '^(v8/tools/profile_view)$',
          '^(v8/tools/profile)$',
          '^(v8/tools/SourceMap)$',
          '^(v8/tools/splaytree)$',
          '^(v8/tools/tickprocessor-driver)$',
          '^(v8/tools/tickprocessor)$',
          '^(node-inspect/lib/_inspect)$',
          '^(node-inspect/lib/internal/inspect_client)$',
          '^(node-inspect/lib/internal/inspect_repl)$',
          '^(async_hooks)$',
          '^(punycode)$',
          '^(domain)$',
          '^(constants)$',
          '^(sys)$',
          '^(_linklist)$',
          '^(_stream_wrap)$',
        ],
      },
    },
    {
      name: 'not-to-deprecated',
      comment:
        'This module uses a (version of an) npm module that has been deprecated. Either upgrade to a later ' +
        'version of that module, or find an alternative. Deprecated modules are a security risk.',
      severity: 'warn',
      from: {},
      to: {
        dependencyTypes: ['deprecated'],
      },
    },
    {
      name: 'no-non-package-json',
      severity: 'error',
      comment:
        "This module depends on an npm package that isn't in the 'dependencies' section of your package.json. " +
        "That's problematic as the package either (1) won't be available on live (2) will be available on live " +
        'with an non-guaranteed version. Fix it by adding the package to the dependencies in your package.json.',
      from: {},
      to: {
        dependencyTypes: ['npm-no-pkg', 'npm-unknown'],
      },
    },
    {
      name: 'not-to-unresolvable',
      comment:
        "This module depends on a module that cannot be found ('resolved to disk'). If it's an npm " +
        'module: add it to your package.json. In all other cases you likely already know what to do.',
      severity: 'error',
      from: {},
      to: {
        couldNotResolve: true,
      },
    },
    {
      name: 'no-duplicate-dep-types',
      comment:
        "Likely this module depends on an external ('npm') package that occurs more than once " +
        'in your package.json i.e. both as a devDependencies and in dependencies. This will cause ' +
        'maintenance problems later on.',
      severity: 'warn',
      from: {},
      to: {
        moreThanOneDependencyType: true,
        // as it's pretty common to have a type import be a type only import
        // _and_ (e.g.) a devDependency - don't consider type-only dependency
        // types for this rule
        dependencyTypesNot: ['type-only'],
      },
    },

    /* Module boundary rules - enforce modular monolith boundaries */
    {
      name: 'auth-module-boundary',
      severity: 'warn',
      comment: 'Auth module should not depend on business logic modules (orders, payments, etc.)',
      from: {
        path: '^src/auth/',
      },
      to: {
        path: '^src/(orders|payments|offers|establishments|favorites|reviews|loyalty|donations|inventory|analytics)/',
      },
    },
    {
      name: 'users-module-boundary',
      severity: 'warn',
      comment: 'Users module should not depend on business logic modules (orders, payments, etc.)',
      from: {
        path: '^src/users/',
      },
      to: {
        path: '^src/(orders|payments|offers|establishments|favorites|reviews|loyalty|donations|inventory|analytics)/',
      },
    },
    {
      name: 'offers-module-boundary',
      severity: 'warn',
      comment:
        'Offers module should only depend on establishments and common modules (auth guards allowed)',
      from: {
        path: '^src/offers/',
      },
      to: {
        path: '^src/(orders|payments|users|favorites|reviews|loyalty|donations|inventory|analytics)/',
      },
    },
    {
      name: 'offers-no-auth-except-guards',
      severity: 'warn',
      comment: 'Offers module can only import from auth/guards, not other auth modules',
      from: {
        path: '^src/offers/',
      },
      to: {
        path: '^src/auth/',
        pathNot: '^src/auth/guards/',
      },
    },
    {
      name: 'orders-module-boundary',
      severity: 'warn',
      comment: 'Orders module should not depend on reviews, favorites, or analytics',
      from: {
        path: '^src/orders/',
      },
      to: {
        path: '^src/(favorites|reviews|loyalty|donations|inventory|analytics)/',
      },
    },
    {
      name: 'payments-module-boundary',
      severity: 'warn',
      comment:
        'Payments module should only depend on orders, users, and common modules (auth guards allowed)',
      from: {
        path: '^src/payments/',
      },
      to: {
        path: '^src/(offers|establishments|favorites|reviews|loyalty|donations|inventory|analytics)/',
      },
    },
    {
      name: 'payments-no-auth-except-guards',
      severity: 'warn',
      comment: 'Payments module can only import from auth/guards, not other auth modules',
      from: {
        path: '^src/payments/',
      },
      to: {
        path: '^src/auth/',
        pathNot: '^src/auth/guards/',
      },
    },
    {
      name: 'common-module-should-be-stable',
      severity: 'warn',
      comment: 'Common module should not depend on any feature modules',
      from: {
        path: '^src/common/',
      },
      to: {
        path: '^src/(auth|users|orders|payments|offers|establishments|favorites|reviews|loyalty|donations|inventory|analytics|notifications|moderation|geolocation|search|health|admin)/',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
      archi: {
        collapsePattern: '^src/[^/]+',
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
