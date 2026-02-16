"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importDefault(require("react"));
const client_1 = __importDefault(require("react-dom/client"));
const contexts_1 = require("./contexts");
const Login_1 = require("./components/Login");
const Login_module_css_1 = __importDefault(require("./components/Login/Login.module.css"));
function AuthenticatedApp() {
    const { user, logout } = (0, contexts_1.useAuth)();
    return ((0, jsx_runtime_1.jsx)("div", { className: Login_module_css_1.default.container, children: (0, jsx_runtime_1.jsx)("div", { className: Login_module_css_1.default.form, children: (0, jsx_runtime_1.jsxs)("div", { className: Login_module_css_1.default.userInfo, children: [(0, jsx_runtime_1.jsxs)("p", { className: Login_module_css_1.default.userName, children: ["Welcome, ", user?.name || user?.email] }), user?.name && (0, jsx_runtime_1.jsx)("p", { className: Login_module_css_1.default.userEmail, children: user.email }), (0, jsx_runtime_1.jsx)("button", { className: Login_module_css_1.default.logoutButton, onClick: logout, children: "Sign Out" })] }) }) }));
}
function AppContent() {
    const { isAuthenticated, isLoading, checkAuth } = (0, contexts_1.useAuth)();
    if (isLoading) {
        return ((0, jsx_runtime_1.jsx)("div", { className: Login_module_css_1.default.container, children: (0, jsx_runtime_1.jsx)("div", { className: Login_module_css_1.default.form, children: (0, jsx_runtime_1.jsx)("p", { style: { color: '#e8eaed', textAlign: 'center' }, children: "Loading..." }) }) }));
    }
    if (isAuthenticated) {
        return (0, jsx_runtime_1.jsx)(AuthenticatedApp, {});
    }
    return (0, jsx_runtime_1.jsx)(Login_1.Login, { onLoginSuccess: checkAuth });
}
function App() {
    return ((0, jsx_runtime_1.jsx)(contexts_1.AuthProvider, { children: (0, jsx_runtime_1.jsx)(AppContent, {}) }));
}
client_1.default.createRoot(document.getElementById('root')).render((0, jsx_runtime_1.jsx)(react_1.default.StrictMode, { children: (0, jsx_runtime_1.jsx)(App, {}) }));
//# sourceMappingURL=main.js.map