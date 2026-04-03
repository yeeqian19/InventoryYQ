import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/", // Tells middleware that the login form is at the root
  },
});

export const config = {
  matcher: [
    // We EXCLUDE "/" from the matcher here so it doesn't 
    // try to protect the login page from itself.
    "/dashboard/:path*",
    "/inventory-branch/:path*",
    "/scan-approve/:path*",
    "/scan-log/:path*",
    "/student-manager/:path*",
    "/RM_Dashboard/:path*",
    "/homepage/:path*",
    "/inventory-hq/:path*",
  ],
};