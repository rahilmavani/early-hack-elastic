import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function Hero() {
  return (
    <section className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
      <div className="order-2 md:order-1">
        <p className="text-ink-muted text-xs font-medium tracking-[0.2em] uppercase">
          Autumn 2026
        </p>
        <h1 className="mt-4 max-w-md text-4xl leading-[1.1] font-semibold tracking-tight md:text-5xl">
          Fewer things, worn longer.
        </h1>
        <p className="text-ink-muted mt-4 max-w-sm text-sm leading-relaxed">
          Outerwear, knits and boots made for the months when you dress with
          intent.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/c/women">
            <Button size="lg">Shop women</Button>
          </Link>
          <Link href="/c/men">
            <Button size="lg" variant="secondary">
              Shop men
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-canvas-muted relative order-1 aspect-[4/5] overflow-hidden md:order-2">
        <Image
          src="/products/wool-coat-camel-1.jpg"
          alt="Belted wool coat in camel"
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}
