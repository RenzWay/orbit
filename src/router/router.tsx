import { HashRouter as Router, Route, Routes } from "react-router-dom";
import App from "../App";
import LoginPage from "../auth/LoginPage";
import TestPage from "../test/test";
import { DeepLinkListener } from "../auth/DeepLinkListener";

export function Rute() {
  const path = [
    {
      path: "/",
      element: <App />,
    },
    { path: "/login", element: <LoginPage /> },
    { path: "/test", element: <TestPage /> },
  ];

  return (
    <Router>
      <DeepLinkListener />
      <Routes>
        {path.map((item, index) => (
          <Route key={index} path={item.path} element={item.element} />
        ))}
      </Routes>
    </Router>
  );
}
