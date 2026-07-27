import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/describe-yourself')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/describe-yourself"!</div>
}
