import { useSignal } from "@preact/signals";
import Counter from "../islands/Counter.tsx";
import { Button } from "../components/Button.tsx";

export default function Home() {
  const count = useSignal(3);
  return (
    <div class="px-4 py-8 mx-auto bg-[#c186ef]">
      <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
        <img
          class="my-6"
          src="/logo.svg"
          width="128"
          height="128"
          alt="the Fresh logo: a sliced lemon dripping with juice"
        />
        <h1 class="text-4xl font-bold">Welcome to b!ngo</h1>
        <Button>Create a new session</Button>
        <input type="number"></input>
        <input type="number"></input>
        <input type="number"></input>
        <input type="number"></input>
        <input type="number"></input>
        <p class="my-4">
          Try updating this message in the
          <code class="mx-2">12345</code> file, and refresh.
        </p>
        <Counter count={count} />
      </div>
    </div>
  );
}
