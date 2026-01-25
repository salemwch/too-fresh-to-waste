[Nest] 16968  - 20/01/2026, 09:56:21    WARN [NominatimService] Nominatim request attempt 1 failed:
[Nest] 16968  - 20/01/2026, 09:56:21    WARN [NominatimService] AxiosError: timeout of 10000ms exceeded
    at RedirectableRequest.handleRequestTimeout (C:\WFA\node_modules\.pnpm\axios@1.12.2\node_modules\axios\lib\adapters\http.js:675:16)
    at RedirectableRequest.emit (node:events:508:28)
    at Timeout.<anonymous> (C:\WFA\node_modules\.pnpm\follow-redirects@1.15.11_debug@4.4.3\node_modules\follow-redirects\index.js:221:12)
    at listOnTimeout (node:internal/timers:605:17)
    at process.processTimers (node:internal/timers:541:7)
    at Axios.request (C:\WFA\node_modules\.pnpm\axios@1.12.2\node_modules\axios\lib\core\Axios.js:45:41) {
  code: 'ECONNABORTED',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [
      'xhr',
      'http',
      'fetch'
    ],
    transformRequest: [
      [Function: transformRequest]
    ],
    transformResponse: [
      [Function: transformResponse]
    ],
    timeout: '10000',
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: {
      FormData: [Function: FormData] [FormData] {
        LINE_BREAK: '\r\n',
        DEFAULT_CONTENT_TYPE: 'application/octet-stream'
      },
      Blob: [class Blob]
    },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json',
      'Content-Type': undefined,
      'User-Agent': 'RescueEats-App/1.0 (https://rescueeats.com; contact@rescueeats.com)',
      'Accept-Language': 'en',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    maxRedirects: 3,
    params: {
      limit: 1,
      'accept-language': 'en',
      addressdetails: 1,
      extratags: 0,
      namedetails: 0,
      dedupe: 1,
      city: 'Paris',
      country: 'France',
      format: 'json'
    },
    cancelToken: CancelToken {
      promise: Promise {
        CanceledError: canceled
            at Object.cancel (C:\WFA\node_modules\.pnpm\axios@1.12.2\node_modules\axios\lib\cancel\CancelToken.js:60:22)
            at C:\WFA\node_modules\.pnpm\@nestjs+axios@4.0.1_@nestjs_0697fc7ac38bfb6fe0b9ca1a6808f017\node_modules\@nestjs\axios\dist\http.service.js:84:34
            at execFinalizer (C:\WFA\node_modules\.pnpm\rxjs@7.8.2\node_modules\rxjs\src\internal\Subscription.ts:208:5)
            at SafeSubscriber.Subscription.unsubscribe (C:\WFA\node_modules\.pnpm\rxjs@7.8.2\node_modules\rxjs\src\internal\Subscription.ts:80:13) 
            at SafeSubscriber.Subscriber.unsubscribe (C:\WFA\node_modules\.pnpm\rxjs@7.8.2\node_modules\rxjs\src\internal\Subscriber.ts:107:24)    
            at SafeSubscriber.Subscriber._error (C:\WFA\node_modules\.pnpm\rxjs@7.8.2\node_modules\rxjs\src\internal\Subscriber.ts:120:12)
            at SafeSubscriber.Subscriber.error (C:\WFA\node_modules\.pnpm\rxjs@7.8.2\node_modules\rxjs\src\internal\Subscriber.ts:86:12)
            at C:\WFA\node_modules\.pnpm\@nestjs+axios@4.0.1_@nestjs_0697fc7ac38bfb6fe0b9ca1a6808f017\node_modules\@nestjs\axios\dist\http.service.js:77:28 {
          code: 'ERR_CANCELED'
        },
        then: [Function (anonymous)]
      },
      _listeners: [],
      reason: CanceledError: canceled
          at Object.cancel (C:\WFA\node_modules\.pnpm\axios@1.12.2\node_modules\axios\lib\cancel\CancelToken.js:60:22)
          at C:\WFA\node_modules\.pnpm\@nestjs+axios@4.0.1_@nestjs_0697fc7ac38bfb6fe0b9ca1a6808f017\node_modules\@nestjs\axios\dist\http.service.js:84:34
          at execFinalizer (C:\WFA\node_modules\.pnpm\rxjs@7.8.2\node_modules\rxjs\src\internal\Subscription.ts:208:5)
          at SafeSubscriber.Subscription.unsubscribe (C:\WFA\node_modules\.pnpm\rxjs@7.8.2\node_modules\rxjs\src\internal\Subscription.ts:80:13)   
          at SafeSubscriber.Subscriber.unsubscribe (C:\WFA\node_modules\.pnpm\rxjs@7.8.2\node_modules\rxjs\src\internal\Subscriber.ts:107:24)      
          at SafeSubscriber.Subscriber._error (C:\WFA\node_modules\.pnpm\rxjs@7.8.2\node_modules\rxjs\src\internal\Subscriber.ts:120:12)
          at SafeSubscriber.Subscriber.error (C:\WFA\node_modules\.pnpm\rxjs@7.8.2\node_modules\rxjs\src\internal\Subscriber.ts:86:12)
          at C:\WFA\node_modules\.pnpm\@nestjs+axios@4.0.1_@nestjs_0697fc7ac38bfb6fe0b9ca1a6808f017\node_modules\@nestjs\axios\dist\http.service.js:77:28 {
        code: 'ERR_CANCELED'
      }
    },
    method: 'get',
    url: 'https://nominatim.openstreetmap.org/search',
    allowAbsoluteUrls: true,
    data: undefined
  },
  request: <ref *4> Writable {
    _events: {
      close: undefined,
      error: [Function: handleRequestError],
      prefinish: undefined,
      finish: undefined,
      drain: undefined,
      response: [Function: handleResponse],
      socket: [
        [Function: handleRequestSocket],
        [Function: destroyOnTimeout]
      ],
      timeout: undefined,
      abort: undefined
    },
    _writableState: WritableState {
      highWaterMark: 16384,
      length: 0,
      corked: 0,
      onwrite: [Function: bound onwrite],
      writelen: 0,
      bufferedIndex: 0,
      pendingcb: 0,
      Symbol(kState): 17580812,
      Symbol(kBufferedValue): null
    },
    _maxListeners: undefined,
    _options: {
      maxRedirects: 3,
      maxBodyLength: Infinity,
      protocol: 'https:',
      path: '/search?limit=1&accept-language=en&addressdetails=1&extratags=0&namedetails=0&dedupe=1&city=Paris&country=France&format=json',        
      method: 'GET',
      headers: [Object: null prototype] {
        Accept: 'application/json',
        'User-Agent': 'RescueEats-App/1.0 (https://rescueeats.com; contact@rescueeats.com)',
        'Accept-Language': 'en',
        'Accept-Encoding': 'gzip, compress, deflate, br'
      },
      agents: {
        http: undefined,
        https: undefined
      },
      auth: undefined,
      family: undefined,
      beforeRedirect: [Function: dispatchBeforeRedirect],
      beforeRedirects: {
        proxy: [Function: beforeRedirect]
      },
      hostname: 'nominatim.openstreetmap.org',
      port: '',
      agent: undefined,
      nativeProtocols: {
        'http:': {
          _connectionListener: [Function: connectionListener],
          METHODS: [
            'ACL',
            'BIND',
            'CHECKOUT',
            'CONNECT',
            'COPY',
            'DELETE',
            'GET',
            'HEAD',
            'LINK',
            'LOCK',
            'M-SEARCH',
            'MERGE',
            'MKACTIVITY',
            'MKCALENDAR',
            'MKCOL',
            'MOVE',
            'NOTIFY',
            'OPTIONS',
            'PATCH',
            'POST',
            'PROPFIND',
            'PROPPATCH',
            'PURGE',
            'PUT',
            'QUERY',
            'REBIND',
            'REPORT',
            'SEARCH',
            'SOURCE',
            'SUBSCRIBE',
            'TRACE',
            'UNBIND',
            'UNLINK',
            'UNLOCK',
            'UNSUBSCRIBE'
          ],
          STATUS_CODES: {
            '100': 'Continue',
            '101': 'Switching Protocols',
            '102': 'Processing',
            '103': 'Early Hints',
            '200': 'OK',
            '201': 'Created',
            '202': 'Accepted',
            '203': 'Non-Authoritative Information',
            '204': 'No Content',
            '205': 'Reset Content',
            '206': 'Partial Content',
            '207': 'Multi-Status',
            '208': 'Already Reported',
            '226': 'IM Used',
            '300': 'Multiple Choices',
            '301': 'Moved Permanently',
            '302': 'Found',
            '303': 'See Other',
            '304': 'Not Modified',
            '305': 'Use Proxy',
            '307': 'Temporary Redirect',
            '308': 'Permanent Redirect',
            '400': 'Bad Request',
            '401': 'Unauthorized',
            '402': 'Payment Required',
            '403': 'Forbidden',
            '404': 'Not Found',
            '405': 'Method Not Allowed',
            '406': 'Not Acceptable',
            '407': 'Proxy Authentication Required',
            '408': 'Request Timeout',
            '409': 'Conflict',
            '410': 'Gone',
            '411': 'Length Required',
            '412': 'Precondition Failed',
            '413': 'Payload Too Large',
            '414': 'URI Too Long',
            '415': 'Unsupported Media Type',
            '416': 'Range Not Satisfiable',
            '417': 'Expectation Failed',
            '418': "I'm a Teapot",
            '421': 'Misdirected Request',
            '422': 'Unprocessable Entity',
            '423': 'Locked',
            '424': 'Failed Dependency',
            '425': 'Too Early',
            '426': 'Upgrade Required',
            '428': 'Precondition Required',
            '429': 'Too Many Requests',
            '431': 'Request Header Fields Too Large',
            '451': 'Unavailable For Legal Reasons',
            '500': 'Internal Server Error',
            '501': 'Not Implemented',
            '502': 'Bad Gateway',
            '503': 'Service Unavailable',
            '504': 'Gateway Timeout',
            '505': 'HTTP Version Not Supported',
            '506': 'Variant Also Negotiates',
            '507': 'Insufficient Storage',
            '508': 'Loop Detected',
            '509': 'Bandwidth Limit Exceeded',
            '510': 'Not Extended',
            '511': 'Network Authentication Required'
          },
          Agent: [Function: Agent] {
            defaultMaxSockets: Infinity
          },
          ClientRequest: [Function: ClientRequest],
          IncomingMessage: [Function: IncomingMessage],
          OutgoingMessage: [Function: OutgoingMessage],
          Server: [Function: Server],
          ServerResponse: [Function: ServerResponse],
          createServer: [Function: createServer],
          validateHeaderName: [Function: validateHeaderName] {
            withoutStackTrace: [Function (anonymous)]
          },
          validateHeaderValue: [Function: validateHeaderValue] {
            withoutStackTrace: [Function (anonymous)]
          },
          get: [Function: get],
          request: [Function: request],
          setMaxIdleHTTPParsers: [Function: setMaxIdleHTTPParsers],
          maxHeaderSize: [Getter],
          globalAgent: [Getter/Setter],
          WebSocket: [Getter],
          CloseEvent: [Getter],
          MessageEvent: [Getter]
        },
        'https:': {
          Agent: [Function: Agent],
          globalAgent: Agent {
            _events: [Object: null prototype],
            _eventsCount: 2,
            _maxListeners: undefined,
            options: [Object: null prototype],
            defaultPort: 443,
            protocol: 'https:',
            requests: [Object: null prototype] {},
            sockets: [Object: null prototype],
            freeSockets: [Object: null prototype] {},
            keepAliveMsecs: 1000,
            keepAlive: true,
            maxSockets: Infinity,
            maxFreeSockets: 256,
            scheduling: 'lifo',
            maxTotalSockets: Infinity,
            totalSocketCount: 1,
            agentKeepAliveTimeoutBuffer: 1000,
            maxCachedSessions: 100,
            _sessionCache: [Object],
            Symbol(shapeMode): false,
            Symbol(kCapture): false
          },
          Server: [Function: Server],
          createServer: [Function: createServer],
          get: [Function: get],
          request: [Function: request]
        }
      },
      pathname: '/search',
      search: '?limit=1&accept-language=en&addressdetails=1&extratags=0&namedetails=0&dedupe=1&city=Paris&country=France&format=json'
    },
    _ended: true,
    _ending: true,
    _redirectCount: 0,
    _redirects: [],
    _requestBodyLength: 0,
    _requestBodyBuffers: [],
    _eventsCount: 3,
    _onNativeResponse: [Function (anonymous)],
    _currentRequest: <ref *3> ClientRequest {
      _events: [Object: null prototype] {
        response: [Function: bound onceWrapper] {
          listener: [Function (anonymous)]
        },
        abort: [Function (anonymous)],
        aborted: [Function (anonymous)],
        connect: [Function (anonymous)],
        error: [Function (anonymous)],
        socket: [Function (anonymous)],
        timeout: [Function (anonymous)]
      },
      _eventsCount: 7,
      _maxListeners: undefined,
      outputData: [],
      outputSize: 0,
      writable: true,
      destroyed: false,
      _last: true,
      chunkedEncoding: false,
      shouldKeepAlive: true,
      maxRequestsOnConnectionReached: false,
      _defaultKeepAlive: true,
      useChunkedEncodingByDefault: false,
      sendDate: false,
      _removedConnection: false,
      _removedContLen: false,
      _removedTE: false,
      strictContentLength: false,
      _contentLength: 0,
      _hasBody: true,
      _trailer: '',
      finished: true,
      _headerSent: true,
      _closed: false,
      _header: 'GET /search?limit=1&accept-language=en&addressdetails=1&extratags=0&namedetails=0&dedupe=1&city=Paris&country=France&format=json HTTP/1.1\r\nAccept: application/json\r\nUser-Agent: RescueEats-App/1.0 (https://rescueeats.com; contact@rescueeats.com)\r\nAccept-Language: en\r\nAccept-Encoding: gzip, compress, deflate, br\r\nHost: nominatim.openstreetmap.org\r\nConnection: keep-alive\r\n\r\n',
      _keepAliveTimeout: 0,
      _onPendingData: [Function: nop],
      agent: Agent {
        _events: [Object: null prototype] {
          free: [Function (anonymous)],
          newListener: [Function: maybeEnableKeylog]
        },
        _eventsCount: 2,
        _maxListeners: undefined,
        options: [Object: null prototype] {
          keepAlive: true,
          scheduling: 'lifo',
          timeout: 5000,
          proxyEnv: undefined,
          defaultPort: 443,
          protocol: 'https:',
          noDelay: true,
          path: null
        },
        defaultPort: 443,
        protocol: 'https:',
        requests: [Object: null prototype] {},
        sockets: [Object: null prototype] {
          'nominatim.openstreetmap.org:443:::::::::::::::::::::': [
            [TLSSocket]
          ]
        },
        freeSockets: [Object: null prototype] {},
        keepAliveMsecs: 1000,
        keepAlive: true,
        maxSockets: Infinity,
        maxFreeSockets: 256,
        scheduling: 'lifo',
        maxTotalSockets: Infinity,
        totalSocketCount: 1,
        agentKeepAliveTimeoutBuffer: 1000,
        maxCachedSessions: 100,
        _sessionCache: {
          map: {
            'nominatim.openstreetmap.org:443:::::::::::::::::::::': <Buffer 30 82 06 0e 02 01 01 02 02 03 04 04 02 13 02 04 20 e9 db 2b 1d f0 57 4b d7 09 36 2c c6 3e 10 d0 9e bd 44 bc 3b e3 af a8 ee a4 48 bf ef b4 1f 2a 46 04 ... 1504 more bytes>
          },
          list: [
            'nominatim.openstreetmap.org:443:::::::::::::::::::::'
          ]
        },
        Symbol(shapeMode): false,
        Symbol(kCapture): false
      },
      socketPath: undefined,
      method: 'GET',
      maxHeaderSize: undefined,
      insecureHTTPParser: undefined,
      joinDuplicateHeaders: undefined,
      path: '/search?limit=1&accept-language=en&addressdetails=1&extratags=0&namedetails=0&dedupe=1&city=Paris&country=France&format=json',        
      _ended: false,
      res: null,
      aborted: false,
      timeoutCb: [Function: emitRequestTimeout],
      upgradeOrConnect: false,
      parser: <ref *2> HTTPParser {
        '0': null,
        '1': [Function: parserOnHeaders],
        '2': [Function: parserOnHeadersComplete],
        '3': [Function: parserOnBody],
        '4': [Function: parserOnMessageComplete],
        '5': null,
        '6': null,
        _headers: [],
        _url: '',
        socket: <ref *1> TLSSocket {
          _tlsOptions: {
            allowHalfOpen: undefined,
            pipe: false,
            secureContext: [SecureContext],
            isServer: false,
            requestCert: true,
            rejectUnauthorized: true,
            session: undefined,
            ALPNProtocols: undefined,
            requestOCSP: undefined,
            enableTrace: undefined,
            pskCallback: undefined,
            highWaterMark: undefined,
            onread: undefined,
            signal: undefined
          },
          _secureEstablished: true,
          _securePending: false,
          _newSessionPending: false,
          _controlReleased: true,
          secureConnecting: false,
          _SNICallback: null,
          servername: 'nominatim.openstreetmap.org',
          alpnProtocol: false,
          authorized: true,
          authorizationError: null,
          encrypted: true,
          _events: [Object: null prototype] {
            close: [Array],
            end: [Array],
            error: [Function: socketErrorListener],
            newListener: [Function: keylogNewListener],
            connect: undefined,
            secure: [Function: onConnectSecure],
            session: [Function (anonymous)],
            free: [Function: onFree],
            timeout: [Array],
            agentRemove: [Function: onRemove],
            data: [Function: socketOnData],
            drain: [Function: ondrain]
          },
          _eventsCount: 11,
          connecting: false,
          _hadError: false,
          _parent: null,
          _host: 'nominatim.openstreetmap.org',
          _closeAfterHandlingError: false,
          _readableState: ReadableState {
            highWaterMark: 16384,
            buffer: [],
            bufferIndex: 0,
            length: 0,
            pipes: [],
            awaitDrainWriters: null,
            Symbol(kState): 193997060
          },
          _writableState: WritableState {
            highWaterMark: 16384,
            length: 0,
            corked: 0,
            onwrite: [Function: bound onwrite],
            writelen: 0,
            bufferedIndex: 0,
            pendingcb: 0,
            Symbol(kState): 17563908,
            Symbol(kBufferedValue): null,
            Symbol(kWriteCbValue): null
          },
          allowHalfOpen: false,
          _maxListeners: undefined,
          _sockname: null,
          _pendingData: null,
          _pendingEncoding: '',
          server: undefined,
          _server: null,
          ssl: TLSWrap {
            _parent: [TCP],
            _parentWrap: null,
            _secureContext: [SecureContext],
            reading: true,
            onkeylog: [Function: onkeylog],
            onhandshakestart: [Function: noop],
            onhandshakedone: [Function (anonymous)],
            onocspresponse: [Function: onocspresponse],
            onnewsession: [Function: onnewsessionclient],
            onerror: [Function: onerror],
            Symbol(owner_symbol): [Circular *1]
          },
          _requestCert: true,
          _rejectUnauthorized: true,
          timeout: 10000,
          parser: [Circular *2],
          _httpMessage: [Circular *3],
          Symbol(alpncallback): null,
          Symbol(res): TLSWrap {
            _parent: [TCP],
            _parentWrap: null,
            _secureContext: [SecureContext],
            reading: true,
            onkeylog: [Function: onkeylog],
            onhandshakestart: [Function: noop],
            onhandshakedone: [Function (anonymous)],
            onocspresponse: [Function: onocspresponse],
            onnewsession: [Function: onnewsessionclient],
            onerror: [Function: onerror],
            Symbol(owner_symbol): [Circular *1]
          },
          Symbol(verified): true,
          Symbol(pendingSession): null,
          Symbol(async_id_symbol): 5215,
          Symbol(kHandle): TLSWrap {
            _parent: [TCP],
            _parentWrap: null,
            _secureContext: [SecureContext],
            reading: true,
            onkeylog: [Function: onkeylog],
            onhandshakestart: [Function: noop],
            onhandshakedone: [Function (anonymous)],
            onocspresponse: [Function: onocspresponse],
            onnewsession: [Function: onnewsessionclient],
            onerror: [Function: onerror],
            Symbol(owner_symbol): [Circular *1]
          },
          Symbol(lastWriteQueueSize): 0,
          Symbol(timeout): Timeout {
            _idleTimeout: 10000,
            _idlePrev: [Timeout],
            _idleNext: [TimersList],
            _idleStart: 14258,
            _onTimeout: [Function: bound ],
            _timerArgs: undefined,
            _repeat: null,
            _destroyed: false,
            Symbol(refed): false,
            Symbol(kHasPrimitive): false,
            Symbol(asyncId): 5224,
            Symbol(triggerId): 5219,
            Symbol(kAsyncContextFrame): undefined
          },
          Symbol(kBuffer): null,
          Symbol(kBufferCb): null,
          Symbol(kBufferGen): null,
          Symbol(shapeMode): true,
          Symbol(kCapture): false,
          Symbol(kSetNoDelay): false,
          Symbol(kSetKeepAlive): true,
          Symbol(kSetKeepAliveInitialDelay): 60,
          Symbol(kBytesRead): 0,
          Symbol(kBytesWritten): 0,
          Symbol(connect-options): {
            rejectUnauthorized: true,
            ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-SHA256:DHE-RSA-AES256-SHA256:HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA', 
            checkServerIdentity: [Function: checkServerIdentity],
            minDHSize: 1024,
            maxRedirects: 3,
            maxBodyLength: Infinity,
            protocol: 'https:',
            path: null,
            method: 'GET',
            headers: [Object: null prototype],
            agents: [Object],
            auth: undefined,
            family: undefined,
            beforeRedirect: [Function: dispatchBeforeRedirect],
            beforeRedirects: [Object],
            hostname: 'nominatim.openstreetmap.org',
            port: 443,
            agent: undefined,
            nativeProtocols: [Object],
            pathname: '/search',
            search: '?limit=1&accept-language=en&addressdetails=1&extratags=0&namedetails=0&dedupe=1&city=Paris&country=France&format=json',       
            _defaultAgent: [Agent],
            host: 'nominatim.openstreetmap.org',
            keepAlive: true,
            scheduling: 'lifo',
            timeout: 5000,
            proxyEnv: undefined,
            defaultPort: 443,
            noDelay: true,
            servername: 'nominatim.openstreetmap.org',
            _agentKey: 'nominatim.openstreetmap.org:443:::::::::::::::::::::',
            encoding: null,
            keepAliveInitialDelay: 1000
          }
        },
        incoming: null,
        outgoing: [Circular *3],
        maxHeaderPairs: 2000,
        _consumed: false,
        onIncoming: [Function: parserOnIncomingClient],
        joinDuplicateHeaders: undefined,
        Symbol(resource_symbol): HTTPClientAsyncResource {
          type: 'HTTPINCOMINGMESSAGE',
          req: [Circular *3]
        }
      },
      maxHeadersCount: null,
      reusedSocket: false,
      host: 'nominatim.openstreetmap.org',
      protocol: 'https:',
      _redirectable: [Circular *4],
      Symbol(shapeMode): false,
      Symbol(kCapture): false,
      Symbol(kBytesWritten): 0,
      Symbol(kNeedDrain): false,
      Symbol(corked): 0,
      Symbol(kChunkedBuffer): [],
      Symbol(kChunkedLength): 0,
      Symbol(kSocket): <ref *1> TLSSocket {
        _tlsOptions: {
          allowHalfOpen: undefined,
          pipe: false,
          secureContext: SecureContext {
            context: SecureContext {}
          },
          isServer: false,
          requestCert: true,
          rejectUnauthorized: true,
          session: undefined,
          ALPNProtocols: undefined,
          requestOCSP: undefined,
          enableTrace: undefined,
          pskCallback: undefined,
          highWaterMark: undefined,
          onread: undefined,
          signal: undefined
        },
        _secureEstablished: true,
        _securePending: false,
        _newSessionPending: false,
        _controlReleased: true,
        secureConnecting: false,
        _SNICallback: null,
        servername: 'nominatim.openstreetmap.org',
        alpnProtocol: false,
        authorized: true,
        authorizationError: null,
        encrypted: true,
        _events: [Object: null prototype] {
          close: [
            [Function: onSocketCloseDestroySSL],
            [Function],
            [Function: onClose],
            [Function: socketCloseListener]
          ],
          end: [
            [Function: onReadableStreamEnd],
            [Function: socketOnEnd]
          ],
          error: [Function: socketErrorListener],
          newListener: [Function: keylogNewListener],
          connect: undefined,
          secure: [Function: onConnectSecure],
          session: [Function (anonymous)],
          free: [Function: onFree],
          timeout: [
            [Function: onTimeout],
            [Function],
            [Function (anonymous)]
          ],
          agentRemove: [Function: onRemove],
          data: [Function: socketOnData],
          drain: [Function: ondrain]
        },
        _eventsCount: 11,
        connecting: false,
        _hadError: false,
        _parent: null,
        _host: 'nominatim.openstreetmap.org',
        _closeAfterHandlingError: false,
        _readableState: ReadableState {
          highWaterMark: 16384,
          buffer: [],
          bufferIndex: 0,
          length: 0,
          pipes: [],
          awaitDrainWriters: null,
          Symbol(kState): 193997060
        },
        _writableState: WritableState {
          highWaterMark: 16384,
          length: 0,
          corked: 0,
          onwrite: [Function: bound onwrite],
          writelen: 0,
          bufferedIndex: 0,
          pendingcb: 0,
          Symbol(kState): 17563908,
          Symbol(kBufferedValue): null,
          Symbol(kWriteCbValue): null
        },
        allowHalfOpen: false,
        _maxListeners: undefined,
        _sockname: null,
        _pendingData: null,
        _pendingEncoding: '',
        server: undefined,
        _server: null,
        ssl: TLSWrap {
          _parent: TCP {
            reading: [Getter/Setter],
            onconnection: null,
            Symbol(owner_symbol): [Circular *1]
          },
          _parentWrap: null,
          _secureContext: SecureContext {
            context: SecureContext {}
          },
          reading: true,
          onkeylog: [Function: onkeylog],
          onhandshakestart: [Function: noop],
          onhandshakedone: [Function (anonymous)],
          onocspresponse: [Function: onocspresponse],
          onnewsession: [Function: onnewsessionclient],
          onerror: [Function: onerror],
          Symbol(owner_symbol): [Circular *1]
        },
        _requestCert: true,
        _rejectUnauthorized: true,
        timeout: 10000,
        parser: <ref *2> HTTPParser {
          '0': null,
          '1': [Function: parserOnHeaders],
          '2': [Function: parserOnHeadersComplete],
          '3': [Function: parserOnBody],
          '4': [Function: parserOnMessageComplete],
          '5': null,
          '6': null,
          _headers: [],
          _url: '',
          socket: [Circular *1],
          incoming: null,
          outgoing: [Circular *3],
          maxHeaderPairs: 2000,
          _consumed: false,
          onIncoming: [Function: parserOnIncomingClient],
          joinDuplicateHeaders: undefined,
          Symbol(resource_symbol): HTTPClientAsyncResource {
            type: 'HTTPINCOMINGMESSAGE',
            req: [Circular *3]
          }
        },
        _httpMessage: [Circular *3],
        Symbol(alpncallback): null,
        Symbol(res): TLSWrap {
          _parent: TCP {
            reading: [Getter/Setter],
            onconnection: null,
            Symbol(owner_symbol): [Circular *1]
          },
          _parentWrap: null,
          _secureContext: SecureContext {
            context: SecureContext {}
          },
          reading: true,
          onkeylog: [Function: onkeylog],
          onhandshakestart: [Function: noop],
          onhandshakedone: [Function (anonymous)],
          onocspresponse: [Function: onocspresponse],
          onnewsession: [Function: onnewsessionclient],
          onerror: [Function: onerror],
          Symbol(owner_symbol): [Circular *1]
        },
        Symbol(verified): true,
        Symbol(pendingSession): null,
        Symbol(async_id_symbol): 5215,
        Symbol(kHandle): TLSWrap {
          _parent: TCP {
            reading: [Getter/Setter],
            onconnection: null,
            Symbol(owner_symbol): [Circular *1]
          },
          _parentWrap: null,
          _secureContext: SecureContext {
            context: SecureContext {}
          },
          reading: true,
          onkeylog: [Function: onkeylog],
          onhandshakestart: [Function: noop],
          onhandshakedone: [Function (anonymous)],
          onocspresponse: [Function: onocspresponse],
          onnewsession: [Function: onnewsessionclient],
          onerror: [Function: onerror],
          Symbol(owner_symbol): [Circular *1]
        },
        Symbol(lastWriteQueueSize): 0,
        Symbol(timeout): Timeout {
          _idleTimeout: 10000,
          _idlePrev: [Timeout],
          _idleNext: [TimersList],
          _idleStart: 14258,
          _onTimeout: [Function: bound ],
          _timerArgs: undefined,
          _repeat: null,
          _destroyed: false,
          Symbol(refed): false,
          Symbol(kHasPrimitive): false,
          Symbol(asyncId): 5224,
          Symbol(triggerId): 5219,
          Symbol(kAsyncContextFrame): undefined
        },
        Symbol(kBuffer): null,
        Symbol(kBufferCb): null,
        Symbol(kBufferGen): null,
        Symbol(shapeMode): true,
        Symbol(kCapture): false,
        Symbol(kSetNoDelay): false,
        Symbol(kSetKeepAlive): true,
        Symbol(kSetKeepAliveInitialDelay): 60,
        Symbol(kBytesRead): 0,
        Symbol(kBytesWritten): 0,
        Symbol(connect-options): {
          rejectUnauthorized: true,
          ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-SHA256:DHE-RSA-AES256-SHA256:HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA',   
          checkServerIdentity: [Function: checkServerIdentity],
          minDHSize: 1024,
          maxRedirects: 3,
          maxBodyLength: Infinity,
          protocol: 'https:',
          path: null,
          method: 'GET',
          headers: [Object: null prototype] {
            Accept: 'application/json',
            'User-Agent': 'RescueEats-App/1.0 (https://rescueeats.com; contact@rescueeats.com)',
            'Accept-Language': 'en',
            'Accept-Encoding': 'gzip, compress, deflate, br'
          },
          agents: {
            http: undefined,
            https: undefined
          },
          auth: undefined,
          family: undefined,
          beforeRedirect: [Function: dispatchBeforeRedirect],
          beforeRedirects: {
            proxy: [Function: beforeRedirect]
          },
          hostname: 'nominatim.openstreetmap.org',
          port: 443,
          agent: undefined,
          nativeProtocols: {
            'http:': [Object],
            'https:': [Object]
          },
          pathname: '/search',
          search: '?limit=1&accept-language=en&addressdetails=1&extratags=0&namedetails=0&dedupe=1&city=Paris&country=France&format=json',
          _defaultAgent: Agent {
            _events: [Object: null prototype],
            _eventsCount: 2,
            _maxListeners: undefined,
            options: [Object: null prototype],
            defaultPort: 443,
            protocol: 'https:',
            requests: [Object: null prototype] {},
            sockets: [Object: null prototype],
            freeSockets: [Object: null prototype] {},
            keepAliveMsecs: 1000,
            keepAlive: true,
            maxSockets: Infinity,
            maxFreeSockets: 256,
            scheduling: 'lifo',
            maxTotalSockets: Infinity,
            totalSocketCount: 1,
            agentKeepAliveTimeoutBuffer: 1000,
            maxCachedSessions: 100,
            _sessionCache: [Object],
            Symbol(shapeMode): false,
            Symbol(kCapture): false
          },
          host: 'nominatim.openstreetmap.org',
          keepAlive: true,
          scheduling: 'lifo',
          timeout: 5000,
          proxyEnv: undefined,
          defaultPort: 443,
          noDelay: true,
          servername: 'nominatim.openstreetmap.org',
          _agentKey: 'nominatim.openstreetmap.org:443:::::::::::::::::::::',
          encoding: null,
          keepAliveInitialDelay: 1000
        }
      },
      Symbol(kOutHeaders): [Object: null prototype] {
        accept: [
          'Accept',
          'application/json'
        ],
        'user-agent': [
          'User-Agent',
          'RescueEats-App/1.0 (https://rescueeats.com; contact@rescueeats.com)'
        ],
        'accept-language': [
          'Accept-Language',
          'en'
        ],
        'accept-encoding': [
          'Accept-Encoding',
          'gzip, compress, deflate, br'
        ],
        host: [
          'Host',
          'nominatim.openstreetmap.org'
        ]
      },
      Symbol(errored): null,
      Symbol(kHighWaterMark): 16384,
      Symbol(kRejectNonStandardBodyWrites): false,
      Symbol(kUniqueHeaders): null
    },
    _currentUrl: 'https://nominatim.openstreetmap.org/search?limit=1&accept-language=en&addressdetails=1&extratags=0&namedetails=0&dedupe=1&city=Paris&country=France&format=json',
    _timeout: null,
    Symbol(shapeMode): true,
    Symbol(kCapture): false
  }
}
[Nest] 16968  - 20/01/2026, 09:56:23     LOG [NominatimService] Successfully geocoded: structured address - 1 results