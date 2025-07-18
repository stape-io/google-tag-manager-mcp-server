#!/usr/bin/env node

/**
 * Script to update all GTM tools with user token support
 * This adds userAccessToken and userRefreshToken parameters to all tools
 */

const fs = require('fs');
const path = require('path');

const TOOLS_DIR = path.join(__dirname, '..', 'src', 'tools');
const SCHEMAS_DIR = path.join(__dirname, '..', 'src', 'schemas');

// User token imports and parameters to add
const USER_TOKEN_IMPORT = ', UserTokens';
const USER_TOKEN_PARAMS = `      userAccessToken: z.string().optional().describe("User's OAuth2 access token"),
      userRefreshToken: z.string().optional().describe("User's OAuth2 refresh token"),`;

const USER_TOKEN_SCHEMA_FIELDS = `  userAccessToken: z.string().optional().describe("User's OAuth2 access token"),
  userRefreshToken: z.string().optional().describe("User's OAuth2 refresh token"),`;

const USER_TOKEN_EXTRACTION = `        // Extract user tokens from arguments
        const userTokens: UserTokens = {
          accessToken: args.userAccessToken,
          refreshToken: args.userRefreshToken,
        };`;

function getAllToolFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllToolFiles(fullPath));
    } else if (item.endsWith('.ts') && item !== 'index.ts') {
      files.push(fullPath);
    }
  }
  
  return files;
}

function updateToolFile(filePath) {
  console.log(`Updating ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Skip if already has UserTokens import
  if (content.includes('UserTokens')) {
    console.log(`  Skipping ${filePath} - already updated`);
    return;
  }

  // Add UserTokens to import statement
  if (content.includes('import { createErrorResponse, getTagManagerClient, log }')) {
    content = content.replace(
      'import { createErrorResponse, getTagManagerClient, log }',
      'import { createErrorResponse, getTagManagerClient, log, UserTokens }'
    );
    modified = true;
  }

  // Update description to mention per-user authentication
  content = content.replace(
    /(".*?"),(\s*)\{/,
    (match, description, whitespace) => {
      if (!description.includes('per-user authentication')) {
        const newDesc = description.slice(0, -1) + '. Supports per-user authentication via userAccessToken or userRefreshToken parameters."';
        return newDesc + ',' + whitespace + '{';
      }
      return match;
    }
  );

  // Add user token parameters to schema (for tools with direct schema objects)
  if (content.includes('async (') && content.includes('}: CallToolResult')) {
    // Find the schema object and add user token fields
    const schemaRegex = /(\{[^}]*)(},\s*async \()/s;
    const match = content.match(schemaRegex);
    if (match && !match[1].includes('userAccessToken')) {
      content = content.replace(schemaRegex, `$1,
${USER_TOKEN_PARAMS}
    $2`);
      modified = true;
    }
  }

  // Update function parameter from destructured to args
  if (content.includes('async ({') && !content.includes('async (args)')) {
    content = content.replace(/async \(\{[^}]*\}\):/g, 'async (args):');
    modified = true;
  }

  // Add user token extraction code
  if (content.includes('log(`Running tool:') && !content.includes('Extract user tokens')) {
    content = content.replace(
      /(log\(`Running tool:[^`]*`\);\s*)(try \{)/,
      `$1
${USER_TOKEN_EXTRACTION}

      $2`
    );
    modified = true;
  }

  // Update getTagManagerClient calls to include userTokens
  const getClientRegex = /(const tagmanager = await getTagManagerClient\(\[[^\]]*\]\))/;
  if (content.match(getClientRegex) && !content.includes(', userTokens')) {
    content = content.replace(getClientRegex, '$1'.replace(')])', '), userTokens)'));
    modified = true;
  }

  // Fix argument references (replace destructured variables with args.variable)
  if (modified) {
    // Common argument patterns to fix
    const argPatterns = [
      { old: /\$\{accountId\}/g, new: '${args.accountId}' },
      { old: /\$\{containerId\}/g, new: '${args.containerId}' },
      { old: /\$\{workspaceId\}/g, new: '${args.workspaceId}' },
      { old: /\$\{tagId\}/g, new: '${args.tagId}' },
      { old: /\$\{triggerId\}/g, new: '${args.triggerId}' },
      { old: /\$\{variableId\}/g, new: '${args.variableId}' },
      { old: /\$\{versionId\}/g, new: '${args.versionId}' },
      { old: /\$\{folderId\}/g, new: '${args.folderId}' },
      { old: /\$\{environmentId\}/g, new: '${args.environmentId}' },
      { old: /\$\{templateId\}/g, new: '${args.templateId}' },
      { old: /\$\{transformationId\}/g, new: '${args.transformationId}' },
      { old: /\$\{zoneId\}/g, new: '${args.zoneId}' },
      { old: /accounts\/\${accountId}/g, new: 'accounts/${args.accountId}' },
      { old: /containers\/\${containerId}/g, new: 'containers/${args.containerId}' },
      { old: /workspaces\/\${workspaceId}/g, new: 'workspaces/${args.workspaceId}' },
    ];

    argPatterns.forEach(pattern => {
      content = content.replace(pattern.old, pattern.new);
    });

    // Fix other direct variable references
    content = content.replace(/: accountId,/g, ': args.accountId,');
    content = content.replace(/: containerId,/g, ': args.containerId,');
    content = content.replace(/: workspaceId,/g, ': args.workspaceId,');
    content = content.replace(/: tagId,/g, ': args.tagId,');
    content = content.replace(/: triggerId,/g, ': args.triggerId,');
    content = content.replace(/: variableId,/g, ': args.variableId,');
    content = content.replace(/fingerprint,/g, 'args.fingerprint,');
    content = content.replace(/fingerprint:/g, 'fingerprint: args.fingerprint,');
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Updated ${filePath}`);
  } else {
    console.log(`  ⏭️  No changes needed for ${filePath}`);
  }
}

function updateSchemaFile(filePath) {
  console.log(`Updating schema ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has user token fields
  if (content.includes('userAccessToken')) {
    console.log(`  Skipping ${filePath} - already updated`);
    return;
  }

  // Add user token fields to schema
  if (content.includes('export const') && content.includes('SchemaFields')) {
    content = content.replace(
      /(},?\s*};)$/m,
      `,
${USER_TOKEN_SCHEMA_FIELDS}
};`
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Updated schema ${filePath}`);
  }
}

function main() {
  console.log('🚀 Starting batch update of GTM tools with user token support...\n');

  // Update all tool files
  const toolFiles = getAllToolFiles(TOOLS_DIR);
  console.log(`Found ${toolFiles.length} tool files to update\n`);

  for (const file of toolFiles) {
    updateToolFile(file);
  }

  // Update all schema files
  console.log('\n📋 Updating schema files...\n');
  const schemaFiles = fs.readdirSync(SCHEMAS_DIR)
    .filter(file => file.endsWith('.ts'))
    .map(file => path.join(SCHEMAS_DIR, file));

  for (const file of schemaFiles) {
    updateSchemaFile(file);
  }

  console.log('\n✅ Batch update completed!');
  console.log('\n🔍 Next steps:');
  console.log('1. Review the changes: git diff');
  console.log('2. Test the build: npm run build');
  console.log('3. Test a few tools manually');
  console.log('4. Commit if everything looks good');
}

if (require.main === module) {
  main();
}