import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>A Seal of Belonging for Every Chaupal</h1>
      <p>
        Twelve village chaupals. Each chaupal has exactly one steward. A
        steward publishes a Merkle root for their own member list; members
        prove membership and mint one non-transferable (soul-bound) seal.
      </p>
      <ul>
        <li>
          <Link href="/steward">Steward console</Link> — set the Merkle root
          for the groups you steward.
        </li>
        <li>
          <Link href="/member">Member portal</Link> — prove membership and
          claim your seal.
        </li>
      </ul>
      <p className="mono">
        Requires a deployed ChaupalSeal contract; configure{" "}
        <code>NEXT_PUBLIC_SEAL_ADDRESS</code> in <code>ui/.env.local</code>.
      </p>
    </>
  );
}