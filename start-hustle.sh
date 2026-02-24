#!/bin/bash

# Start Hustle Agent on ARO v3 Tasks
# This script initializes Hustle to begin ROADMAP v3 implementation

echo "🚀 Starting Hustle Agent for ARO v3..."
echo ""

cd ~/.cylon/master

# Create work request
node -e "
import('./src/agent/executor.js').then(async (executor) => {
  const result = await executor.execute({
    agentId: 'a2c65c8f-0486-40a2-8883-6280f677af6a',
    agentName: 'Hustle',
    workspace: '7ff9447e-3e86-4f38-8129-43fadfff4986',
    task: 'self-improve',
    workDir: '/Users/cylon/Desktop/agent-rate-oracle',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    context: 'Read ROADMAP-v3.md and begin with Task 1 of Phase 1: Agent Service Comparison'
  });
  console.log('Work started:', result);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
" &

sleep 2
echo ""
echo "✅ Hustle agent initialized!"
echo ""
echo "Monitor progress with:"
echo "  tail -f ~/Desktop/agent-rate-oracle/CYCLE_LOG.md"
echo ""
echo "Or check ROADMAP progress:"
echo "  grep -c '\[x\]' ~/Desktop/agent-rate-oracle/ROADMAP-v3.md"
