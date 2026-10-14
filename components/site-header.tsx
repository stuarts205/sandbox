import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs"
import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between px-4">
      <Link href="/" className="flex items-center gap-2 font-medium">
        <Image src="/logo.svg" alt="" width={24} height={24} />
        Sandbox
      </Link>
      <div className="flex items-center gap-2">
        <Show when="signed-out">
          <SignInButton>
            <Button variant="ghost">Sign in</Button>
          </SignInButton>
          <SignUpButton>
            <Button>Sign up</Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  )
}
