import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/seller-type')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/seller-type"!</div>
}
