import Link from "next/link";
export default function NotFound() {
  return (
    <main className="container section">
      <p className="eyebrow">AB SYSTEMS TECH / 404</p>
      <h1>
        Página no encontrada
        <br />
        Page not found
      </h1>
      <div className="actions">
        <Link className="button" href="/es">
          Inicio
        </Link>
        <Link className="button outline" href="/en">
          Home
        </Link>
      </div>
    </main>
  );
}
