import * as authController from '../modules/auth/auth.controller.js';

export const login = authController.login;
export const refresh = authController.refresh;
export const logout = authController.logout;
export const register = authController.register;
export const forgotPassword = authController.forgotPassword;
export const resetPassword = authController.resetPassword;
export default authController;