import { auth } from "@clerk/nextjs/server"

export default async function Page(props: PageProps<"/games/[id]">) {
  await auth.protect({ unauthenticatedUrl: "/sign-in" })

  const { id } = await props.params

  return <p>{id}</p>
}
