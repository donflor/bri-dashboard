with open("server.ts", "r") as f:
    content = f.read()

socket_handlers = """
    // BMC V2 Event Handlers
    socket.on('agent:log', (data) => {
      io.emit('agent_log', data);
    });

    socket.on('approval:response', (data) => {
      io.emit('approval_update', data);
    });

    socket.on('task:update', (data) => {
      io.emit('task_update', data);
    });
"""

content = content.replace("socket.on('refresh', async () => {", socket_handlers + "\n    socket.on('refresh', async () => {")

with open("server.ts", "w") as f:
    f.write(content)
