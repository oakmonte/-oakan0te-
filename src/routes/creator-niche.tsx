import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/creator-niche')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/creator-niche"!</div>
}
