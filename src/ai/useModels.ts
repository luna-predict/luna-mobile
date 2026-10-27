import { useEffect, useState } from 'react';
import { ModelManager } from '../services/ModelManager';

/** Re-render when any model's download state or the active coach model changes. */
export function useModelRegistryVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    ModelManager.init().then(() => setVersion(v => v + 1));
    return ModelManager.subscribe(() => setVersion(v => v + 1));
  }, []);
  return version;
}
