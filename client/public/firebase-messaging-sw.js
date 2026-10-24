importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

const firebaseConfig = Object.fromEntries(new URL(self.location.href).searchParams.entries());
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
	// FCM automatically displays notification payloads; only data payloads need a manual display.
	if (payload.notification) return;

	const title = payload.data?.title || 'New notification';
	const body = payload.data?.body || '';
	const link = payload.data?.link || self.registration.scope;
	self.registration.showNotification(title, {
		body,
		icon: '/notification-icon.svg',
		data: { link },
	});
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL(event.notification.data?.link || '/', self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
			const appWindow = windows.find((client) => client.url.startsWith(self.location.origin));
			if (appWindow) {
				return appWindow.navigate(target).then(() => appWindow.focus());
			}
			return self.clients.openWindow(target);
		}),
	);
});
