export async function startServer(app, port) {
  app.listen(port, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
