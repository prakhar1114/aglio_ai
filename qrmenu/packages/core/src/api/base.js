export const getBaseApiCandidates = () => {
  const envBase = import.meta.env.VITE_API_BASE;
  const candidates = [];
  if (envBase) candidates.push(envBase);
  // candidates.push('http://0.0.0.0:8005');
  // candidates.push('http://localhost:8005');
  // fallback to same origin
  // candidates.push('');
  return [...new Set(candidates)];
}; 