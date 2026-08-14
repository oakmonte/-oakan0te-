import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/store/theme')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/store/theme"!</div>
}
