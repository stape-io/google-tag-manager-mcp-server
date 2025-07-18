#!/usr/bin/env node

/**
 * Quick fix for syntax errors from the batch update script
 */

const fs = require('fs');
const path = require('path');

const FILES_TO_FIX = [
  'src/tools/clients/revert.ts',
  'src/tools/clients/update.ts',
  'src/tools/containers/update.ts',
  'src/tools/environments/update.ts',
  'src/tools/folders/revert.ts',
  'src/tools/folders/update.ts',
  'src/tools/gtag-config/update.ts',
  'src/tools/tags/revert.ts',
  'src/tools/tags/update.ts',
  'src/tools/templates/revert.ts',
  'src/tools/templates/update.ts',
  'src/tools/transformations/revert.ts',
  'src/tools/transformations/update.ts',
  'src/tools/triggers/revert.ts',
  'src/tools/triggers/update.ts',
  'src/tools/variables/revert.ts',
  'src/tools/variables/update.ts',
  'src/tools/versions/publish.ts',
  'src/tools/versions/update.ts',
  'src/tools/workspaces/resolveConflict.ts',
  'src/tools/workspaces/update.ts',
  'src/tools/zones/revert.ts',
  'src/tools/zones/update.ts'
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Fix common patterns that broke
  
  // Fix missing commas after destructuring
  content = content.replace(/(\w+): args\.\w+([^,}])\s*}/g, '$1: args.$1$2,\n      }');
  
  // Fix missing commas in object destructuring
  content = content.replace(/(\w+):\s*args\.\w+\s*([^,}]+)$/gm, '$1: args.$1,$2');
  
  // Fix specific patterns
  content = content.replace(/const \{ userAccessToken, userRefreshToken, \.\.\.(\w+) \} = args;/g, 
    'const { userAccessToken, userRefreshToken, ...$1 } = args;');
    
  // Fix requestBody patterns
  content = content.replace(/requestBody: (\w+)([^,}])/g, 'requestBody: $1,$2');
  
  // Ensure proper comma placement
  content = content.replace(/fingerprint: args\.fingerprint([^,])/g, 'fingerprint: args.fingerprint,$1');
  
  fs.writeFileSync(fullPath, content);
  console.log(`  ✅ Fixed ${filePath}`);
}

function main() {
  console.log('🔧 Fixing TypeScript syntax errors...\n');
  
  for (const file of FILES_TO_FIX) {
    try {
      fixFile(file);
    } catch (error) {
      console.log(`  ❌ Error fixing ${file}:`, error.message);
    }
  }
  
  console.log('\n✅ Syntax fixes completed!');
  console.log('Run npm run build to test the fixes');
}

if (require.main === module) {
  main();
}