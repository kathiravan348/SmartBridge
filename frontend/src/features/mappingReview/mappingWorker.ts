import { runMappingEngine, MappingResult } from './mappingEngine';

self.onmessage = (e: MessageEvent) => {
  const { sourceHeaders, threshold, engineVersion } = e.data;
  try {
    const result: MappingResult = runMappingEngine(sourceHeaders, threshold, engineVersion);
    self.postMessage({ type: 'SUCCESS', result });
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', error: error.message });
  }
};
