import { useEffect, useState } from 'react';
import axios from 'axios';

import { environment } from '@/config/environment';
import { Logger } from '@/utils/logger';

interface VersionConfig {
  minVersion: string;
  latestVersion: string;
  updateUrl: string;
}

type UpdateType = 'none' | 'soft' | 'force';

interface VersionCheckResult {
  updateType: UpdateType;
  updateUrl: string;
  latestVersion: string;
  dismissed: boolean;
  dismiss: () => void;
}

function isVersionBelow(version: string, target: string): boolean {
  const parse = (v: string): number[] =>
    v.split('.').map(n => {
      const parsed = parseInt(n, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    });

  const current = parse(version);
  const minimum = parse(target);
  const maxLen = Math.max(current.length, minimum.length);

  for (let i = 0; i < maxLen; i++) {
    const c = current[i] ?? 0;
    const m = minimum[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false;
}

export function useAppVersionCheck(): VersionCheckResult {
  const [config, setConfig] = useState<VersionConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchVersionConfig() {
      try {
        const response = await axios.get<{ data: VersionConfig }>(
          `${environment.api.baseUrl}/config/app-version`,
          { timeout: 5000 },
        );
        if (!cancelled) {
          setConfig(response.data.data);
        }
      } catch {
        Logger.debug('[VersionCheck] Failed to fetch version config — skipping check');
      }
    }

    fetchVersionConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) {
    return {
      updateType: 'none',
      updateUrl: '',
      latestVersion: '',
      dismissed: false,
      dismiss: () => {},
    };
  }

  const clientVersion = environment.app.version;
  let updateType: UpdateType = 'none';

  if (isVersionBelow(clientVersion, config.minVersion)) {
    updateType = 'force';
  } else if (isVersionBelow(clientVersion, config.latestVersion)) {
    updateType = 'soft';
  }

  return {
    updateType,
    updateUrl: config.updateUrl,
    latestVersion: config.latestVersion,
    dismissed,
    dismiss: () => setDismissed(true),
  };
}
