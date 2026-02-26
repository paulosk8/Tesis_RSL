// patch-openai.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/domain/use-cases');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('require(\'openai\')')) {
    console.log(`Patching ${file}`);

    // Require replacement
    content = content.replace(/const OpenAI = require\('openai'\);/, 'const { GoogleGenerativeAI } = require(\'@google/generative-ai\');');

    // Constructor/Init replacement
    content = content.replace(/this\.openai = new OpenAI\(\{[\s\S]*?apiKey: process\.env\.OPENAI_API_KEY[\s\S]*?}\);/, 'this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);');
    content = content.replace(/this\.openai = new OpenAI\(\{ apiKey: openaiApiKey }\);/, 'this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);');
    content = content.replace(/if \(process\.env\.OPENAI_API_KEY\) \{/g, 'if (process.env.GEMINI_API_KEY) {');
    content = content.replace(/openaiApiKey = process\.env\.OPENAI_API_KEY/g, 'geminiApiKey = process.env.GEMINI_API_KEY');
    content = content.replace(/if \(openaiApiKey\) \{/g, 'if (geminiApiKey) {');

    // Check replacement
    content = content.replace(/!this\.openai/g, '!this.gemini');
    content = content.replace(/this\.openai/g, 'this.gemini');
    content = content.replace(/OpenAI no está configurado/g, 'Gemini no está configurado');
    content = content.replace(/OpenAI API key no configurada/g, 'Gemini API key no configurada');

    // Generation Replacement - This is trickier due to dynamic options
    // I will write a regex to replace the typical chat.completions.create blocks
    const aiCallRegex = /const completion = await this\.gemini\.chat\.completions\.create\(\{[\s\S]*?messages:\s*\[([\s\S]*?)\],?[\s\S]*?(temperature:\s*[\d\.]+)?[\s\S]*?\}\);[\s\S]*?(?:text|const content) = completion\.choices\[0\]\.message\.content;/g;
    
    // Actually we can just find where `this.gemini.chat.completions.create` is and manually fix since AST is better.
    // I'll replace it with a generic helper function call or inline it.
    
    fs.writeFileSync(filePath, content, 'utf8');
  }
});
console.log('Done patching use-cases preliminary steps.');
