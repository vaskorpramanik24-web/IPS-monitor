// Fill these in from Firebase Console → Project settings → General → Your apps → SDK setup and config.
// This config is safe to expose publicly — Firebase access is controlled by database.rules.json,
// not by hiding this object.
const firebaseConfig = {
  apiKey: "AIzaSyCWwXNlFYDRyyXgdnAnia3FzgeZk5HmC1Y",
  authDomain: "ips-monitor.firebaseapp.com",
  databaseURL: "https://ips-monitor-default-rtdb.firebaseio.com",
  projectId: "ips-monitor",
  storageBucket: "ips-monitor.firebasestorage.app",
  messagingSenderId: "382668565531",
  appId: "1:382668565531:web:8feecc2f50d381171bdcbe"
  measurementId: "G-YVZDZKJRLF"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
