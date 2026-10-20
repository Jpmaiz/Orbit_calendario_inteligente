import type { AdaptadorIA } from './adaptador';
import { ia as deepseek } from './deepseek';
import { ia as gemini } from './gemini';

const usarGemini = process.env.IA_PROVEEDOR === 'gemini';

// Cambias de proveedor desde .env, sin tocar código
export const ia: AdaptadorIA = usarGemini ? gemini : deepseek;
export const modeloIA = usarGemini ? 'gemini-3.8-flash' : 'deepseek-flash';