"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Login = Login;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Login_module_css_1 = __importDefault(require("./Login.module.css"));
const contexts_1 = require("../../contexts");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateForm(data) {
    const errors = {};
    if (!data.email.trim()) {
        errors.email = 'Email is required';
    }
    else if (!EMAIL_REGEX.test(data.email)) {
        errors.email = 'Please enter a valid email address';
    }
    if (!data.password) {
        errors.password = 'Password is required';
    }
    return errors;
}
// Microsoft logo SVG component
function MicrosoftLogo() {
    return ((0, jsx_runtime_1.jsxs)("svg", { xmlns: "http://www.w3.org/2000/svg", width: "21", height: "21", viewBox: "0 0 21 21", children: [(0, jsx_runtime_1.jsx)("rect", { x: "1", y: "1", width: "9", height: "9", fill: "#f25022" }), (0, jsx_runtime_1.jsx)("rect", { x: "11", y: "1", width: "9", height: "9", fill: "#7fba00" }), (0, jsx_runtime_1.jsx)("rect", { x: "1", y: "11", width: "9", height: "9", fill: "#00a4ef" }), (0, jsx_runtime_1.jsx)("rect", { x: "11", y: "11", width: "9", height: "9", fill: "#ffb900" })] }));
}
// Future: Add GoogleLogo, FacebookLogo components when social providers are enabled
function Login({ onLoginSuccess }) {
    const { login: oauthLogin } = (0, contexts_1.useAuth)();
    const [showEmailForm, setShowEmailForm] = (0, react_1.useState)(false);
    const [formData, setFormData] = (0, react_1.useState)({
        email: '',
        password: '',
    });
    const [errors, setErrors] = (0, react_1.useState)({});
    const [serverError, setServerError] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    /**
     * Handle OAuth sign-in via CIAM.
     * This initiates the External Identities flow which handles both sign-in and sign-up.
     */
    const handleOAuthSignIn = (provider) => {
        oauthLogin(provider);
    };
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
        if (serverError) {
            setServerError(null);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validateForm(formData);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        setIsLoading(true);
        setServerError(null);
        try {
            const response = await fetch('/api/auth/login/dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Login failed. Please check your credentials.');
            }
            onLoginSuccess?.();
        }
        catch (err) {
            setServerError(err instanceof Error ? err.message : 'An unexpected error occurred');
        }
        finally {
            setIsLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: Login_module_css_1.default.container, children: (0, jsx_runtime_1.jsxs)("div", { className: Login_module_css_1.default.form, children: [(0, jsx_runtime_1.jsx)("h1", { className: Login_module_css_1.default.title, children: "Sign In" }), serverError && ((0, jsx_runtime_1.jsx)("div", { className: Login_module_css_1.default.serverError, role: "alert", children: serverError })), (0, jsx_runtime_1.jsxs)("button", { type: "button", className: Login_module_css_1.default.microsoftButton, onClick: () => handleOAuthSignIn('microsoft'), "aria-label": "Sign in with Microsoft", children: [(0, jsx_runtime_1.jsx)(MicrosoftLogo, {}), (0, jsx_runtime_1.jsx)("span", { children: "Sign in with Microsoft" })] }), !showEmailForm ? ((0, jsx_runtime_1.jsx)("button", { type: "button", className: Login_module_css_1.default.emailToggle, onClick: () => setShowEmailForm(true), children: "Use email instead" })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: Login_module_css_1.default.divider, children: (0, jsx_runtime_1.jsx)("span", { children: "or" }) }), (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, noValidate: true, children: [(0, jsx_runtime_1.jsxs)("div", { className: Login_module_css_1.default.field, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "email", className: Login_module_css_1.default.label, children: "Email" }), (0, jsx_runtime_1.jsx)("input", { id: "email", name: "email", type: "email", autoComplete: "email", value: formData.email, onChange: handleChange, className: `${Login_module_css_1.default.input} ${errors.email ? Login_module_css_1.default.inputError : ''}`, disabled: isLoading, "aria-describedby": errors.email ? 'email-error' : undefined }), errors.email && ((0, jsx_runtime_1.jsx)("span", { id: "email-error", className: Login_module_css_1.default.fieldError, children: errors.email }))] }), (0, jsx_runtime_1.jsxs)("div", { className: Login_module_css_1.default.field, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "password", className: Login_module_css_1.default.label, children: "Password" }), (0, jsx_runtime_1.jsx)("input", { id: "password", name: "password", type: "password", autoComplete: "current-password", value: formData.password, onChange: handleChange, className: `${Login_module_css_1.default.input} ${errors.password ? Login_module_css_1.default.inputError : ''}`, disabled: isLoading, "aria-describedby": errors.password ? 'password-error' : undefined }), errors.password && ((0, jsx_runtime_1.jsx)("span", { id: "password-error", className: Login_module_css_1.default.fieldError, children: errors.password }))] }), (0, jsx_runtime_1.jsx)("button", { type: "submit", className: Login_module_css_1.default.submitButton, disabled: isLoading, children: isLoading ? 'Signing in...' : 'Sign In' })] })] }))] }) }));
}
exports.default = Login;
//# sourceMappingURL=Login.js.map