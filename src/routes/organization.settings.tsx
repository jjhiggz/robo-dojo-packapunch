import { createFileRoute } from '@tanstack/react-router'
import { Building2, Calendar } from 'lucide-react'
import { useBoardContext } from '@/lib/board-context'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export const Route = createFileRoute('/organization/settings')({
  component: OrganizationSettingsPage,
})

function OrganizationSettingsPage() {
  const { currentOrg } = useBoardContext()

  if (!currentOrg) {
    return null
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 font-extrabold uppercase">
            <Building2 className="w-6 h-6 text-primary" />
            Organization Information
          </CardTitle>
          <CardDescription className="font-medium">
            Basic details about your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="font-bold">Organization Name</Label>
            <Input value={currentOrg.name} disabled className="border-2" />
            <p className="text-xs text-muted-foreground font-medium">
              Contact a superadmin to change the organization name
            </p>
          </div>

          <div className="space-y-2">
            <Label className="font-bold">Slug</Label>
            <Input value={currentOrg.slug} disabled className="border-2" />
            <p className="text-xs text-muted-foreground font-medium">
              Auto-generated from organization name
            </p>
          </div>

          <div className="space-y-2">
            <Label className="font-bold">Your Role</Label>
            <Input value={currentOrg.role} disabled className="border-2 capitalize" />
            <p className="text-xs text-muted-foreground font-medium">
              Your current role in this organization
            </p>
          </div>

          <div className="space-y-2">
            <Label className="font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Created
            </Label>
            <Input
              value={new Date(currentOrg.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              disabled
              className="border-2"
            />
            <p className="text-xs text-muted-foreground font-medium">
              Organization creation date
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <h3 className="font-extrabold uppercase mb-2">Future Settings</h3>
          <p className="text-sm text-muted-foreground font-medium">
            Additional organization settings will be added here in future updates, such as:
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground font-medium list-disc list-inside">
            <li>Billing and subscription management</li>
            <li>Organization branding and customization</li>
            <li>Default board permissions</li>
            <li>Integrations and webhooks</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
