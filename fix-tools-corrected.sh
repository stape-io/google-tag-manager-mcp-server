#!/bin/bash

# Fix TypeScript errors in tool files by updating function signatures
# 1. Replace ": void =>" with ": RegisteredTool =>"
# 2. Replace "= (server: McpServer) =>" with "= (server: McpServer): RegisteredTool =>"

echo "Fixing tool function signatures..."

# Fix functions that have ": void =>"
find src/tools -name "*.ts" -exec sed -i 's/= (server: McpServer): void =>/= (server: McpServer): RegisteredTool =>/g' {} \;

# Fix functions that have no return type "= (server: McpServer) =>"
find src/tools -name "*.ts" -exec sed -i 's/= (server: McpServer) =>/= (server: McpServer): RegisteredTool =>/g' {} \;

echo "Fixed all tool files - functions now return RegisteredTool"