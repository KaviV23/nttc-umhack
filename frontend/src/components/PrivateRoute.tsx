import { ReactNode } from 'react'
import { Navigate } from "react-router-dom";

type PrivateRouteProps = {
  children: ReactNode
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const token = localStorage.getItem("access_token");

  return token ? children : <Navigate to="/auth/login" />;
};

export default PrivateRoute;
