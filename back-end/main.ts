const conn = Deno.listen({ port: 80 });
const httpConn = Deno.serve(async () => {
  await conn.accept()
});
const e = await httpConn.nextRequest();
if (e) {
  const { socket, response } = Deno.upgradeWebSocket(e.request);
  socket.onopen = () => {
    socket.send("Hello World!");
  };
  socket.onmessage = (e) => {
    console.log(e.data);
    socket.close();
  };
  socket.onclose = () => console.log("WebSocket has been closed.");
  socket.onerror = (e) => console.error("WebSocket error:", e);
  e.respondWith(response);
}