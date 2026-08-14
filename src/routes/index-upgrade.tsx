import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/index-upgrade')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/index-upgrade"!</div>
}
