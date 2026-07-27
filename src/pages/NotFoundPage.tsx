import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="text-center">
      <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
      <Link to="/" className="text-primary underline">
        Return to Home
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
