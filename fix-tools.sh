#!/bin/bash

# Script to fix all tool exports to return RegisteredTool instead of void

find src/tools -name "*.ts" -exec sed -i 's/): void =>/): RegisteredTool =>/g' {} \;
find src/tools -name "*.ts" -exec sed -i 's/) => {/): RegisteredTool => {/g' {} \;
find src/tools -name "*.ts" -exec sed -i 's/) =>$/): RegisteredTool =>$/g' {} \;
find src/tools -name "*.ts" -exec sed -i 's/= (server: McpServer): void =/= (server: McpServer): RegisteredTool =/g' {} \;
find src/tools -name "*.ts" -exec sed -i 's/= (server: McpServer) =>/= (server: McpServer): RegisteredTool =>/g' {} \;

echo "Fixed all tool exports to return RegisteredTool"