import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn('GEMINI_API_KEY is not set. AI features may not work.');
    }
    ai = new GoogleGenAI({ apiKey: key || '' });
  }
  return ai;
}

export interface CustomPrompts {
  analysis?: string;
  improvement?: string;
  email?: string;
  whatsapp?: string;
}

export async function generateImprovementSuggestion(
  category: string, 
  description: string,
  type: 'analysis' | 'email' | 'whatsapp' | 'improvement' = 'analysis',
  customPrompts?: CustomPrompts
): Promise<string> {
  try {
    const client = getGeminiClient();
    
    let promptTask = '';
    if (type === 'analysis') {
      promptTask = customPrompts?.analysis || `Forneça uma sugestão prática, estruturada e direta de como abordar e resolver esse problema. Inclua possíveis causas raízes a investigar e um plano de ação inicial.`;
    } else if (type === 'improvement') {
      promptTask = customPrompts?.improvement || `Gere um Registro de Melhorias: Foco em ações de longo prazo e processos (ex: revisão de ficha técnica, treinamento de operadores ou manutenção preventiva) para este problema.`;
    } else if (type === 'email') {
      promptTask = customPrompts?.email || `Gere um Modelo para E-mail (Comunicado Formal):
Assunto: Informativo de Problema e Melhoria: [Resumo do Problema]
Crie uma mensagem profissional e direta. NÃO USE EMOJIS. NÃO USE formatação Markdown (como asteriscos para negrito), use apenas texto simples.
A mensagem deve conter:
1. Descrição do Problema: Qual é o problema identificado.
2. Riscos e Impactos: O que esse problema pode causar (impactos na produção, qualidade, segurança, etc.).
3. Ação/Melhoria: O que está sendo feito ou proposto para resolver.
Texto bem estruturado, com saudação inicial e encerramento profissional.`;
    } else if (type === 'whatsapp') {
      promptTask = customPrompts?.whatsapp || `Gere um Modelo para WhatsApp (Comunicado Operacional):
Crie uma mensagem clara e direta para a equipe. ABSOLUTAMENTE SEM EMOJIS. NÃO USE formatação Markdown (como asteriscos para negrito), use apenas texto simples.
A mensagem deve conter:
1. O Problema: Descrição breve do problema.
2. O Risco: O que isso pode causar se não for resolvido.
3. A Ação: O que deve ser feito ou está sendo feito.
Formato em texto simples, fácil de ler no celular.`;
    }

    const prompt = `Você é um especialista em melhoria contínua e engenharia de produção (Lean Manufacturing, Six Sigma).
O usuário registrou uma nova oportunidade de melhoria na fábrica.

Categoria: ${category}
Descrição do Problema/Melhoria: ${description}

Tarefa solicitada:
${promptTask}

Responda em português do Brasil de forma profissional e encorajadora. Siga exatamente o formato solicitado.`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || 'Não foi possível gerar uma sugestão no momento.';
  } catch (error) {
    console.error('Error generating suggestion:', error);
    return 'Erro ao conectar com a inteligência artificial. Tente novamente mais tarde.';
  }
}

export async function generateTopScrapsSuggestion(topScraps: any[]): Promise<string> {
  try {
    const client = getGeminiClient();
    const prompt = `Você é um consultor de melhoria contínua. Analise os seguintes dados de refugo (scrap) e sugira ações prioritárias para reduzir as perdas:
    ${JSON.stringify(topScraps)}
    Forneça uma análise concisa e 3 ações práticas.`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || 'Não foi possível gerar sugestões para os refugos.';
  } catch (error) {
    console.error('Error generating scrap suggestion:', error);
    return 'Erro ao gerar sugestões de refugo.';
  }
}
