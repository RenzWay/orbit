import { PrivateRoute } from "../auth/PrivateRoute";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "../App";
import TestPage from "../test/test";
import LoginPage from "../auth/LoginPage";

export function Rute() {
  const path = [
    {
      path: "/",
      element: (
        <PrivateRoute>
          <App />
        </PrivateRoute>
      ),
    },
    { path: "/login", element: <LoginPage /> },
    { path: "/test", element: <TestPage /> },
  ];

  return (
    <BrowserRouter>
      <Routes>
        {path.map((item, index) => (
          <Route key={index} path={item.path} element={item.element} />
        ))}
      </Routes>
    </BrowserRouter>
  );
}
