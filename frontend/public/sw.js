self.addEventListener("push", (event) => {
  let data = {
    title: "Agente Trader",
    body: "Novo alerta disponível.",
    url: "/",
  };

  try {
    data = event.data ? event.data.json() : data;
  } catch (error) {
    // Mantém fallback
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Agente Trader", {
      body: data.body || "Novo alerta disponível.",
      icon: "/vite.svg",
      badge: "/vite.svg",
      data: {
        url: data.url || "/",
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
