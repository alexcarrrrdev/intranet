"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { updateAppNameAction } from "@/app/actions/app-settings"
import {
  updateAppNameSchema,
  type UpdateAppNameInput,
} from "@/lib/settings/schemas"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

type AppNameFormProps = {
  defaultAppName: string
}

export function AppNameForm({ defaultAppName }: AppNameFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<UpdateAppNameInput>({
    resolver: zodResolver(updateAppNameSchema),
    defaultValues: { appName: defaultAppName },
  })

  async function onSubmit(values: UpdateAppNameInput) {
    setIsPending(true)
    setError(null)
    try {
      const result = await updateAppNameAction(values)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("Les paramètres ont été enregistrés.")
      // Rafraîchit le nom affiché dans la barre latérale (fourni par le
      // layout, un Server Component) sans recharger toute la page.
      router.refresh()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="appName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom de l&apos;application</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="mt-2 w-fit" disabled={isPending}>
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>
    </Form>
  )
}
