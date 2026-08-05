"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { CircleAlertIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { createGroupAction } from "@/app/actions/groups"
import { createGroupSchema } from "@/lib/groups/schemas"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// Dialog de création d'un groupe (/groupes), réservé aux détenteurs de
// `group:manage` — le bouton qui l'ouvre n'est rendu que côté page pour ces
// utilisateurs, la vérification qui fait autorité reste dans
// createGroupAction. Le créateur devient automatiquement membre (voir
// createGroup, src/lib/groups/groups.ts).
// Valeurs du formulaire : `description` reste une chaîne (potentiellement
// vide) tant que la validation zod ne l'a pas transformée en
// `string | undefined` (voir createGroupSchema, .optional().transform) —
// pas de resolver zod direct ici pour éviter ce décalage de type entre
// l'entrée et la sortie du schéma.
type FormValues = { name: string; description: string }

type NewGroupDialogProps = {
  // "icon" : petit bouton "+" sans texte, utilisé dans le rail gauche de
  // /fil (espace restreint) — "button" (défaut) : bouton complet "Nouveau
  // groupe", utilisé ailleurs.
  trigger?: "button" | "icon"
}

export function NewGroupDialog({ trigger = "button" }: NewGroupDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const form = useForm<FormValues>({
    defaultValues: { name: "", description: "" },
  })

  async function onSubmit(values: FormValues) {
    setError(null)
    const parsed = createGroupSchema.safeParse({
      name: values.name,
      description: values.description || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Groupe invalide.")
      return
    }

    setIsPending(true)
    try {
      const result = await createGroupAction(parsed.data)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("Le groupe a été créé.")
      form.reset()
      setOpen(false)
      router.refresh()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          form.reset()
          setError(null)
        }
      }}
    >
      <DialogTrigger
        render={
          trigger === "icon" ? (
            <Button variant="ghost" size="icon" className="size-6" aria-label="Nouveau groupe">
              <PlusIcon className="size-4" />
            </Button>
          ) : (
            <Button>
              <PlusIcon className="size-4" />
              Nouveau groupe
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau groupe</DialogTitle>
          <DialogDescription>
            Vous en deviendrez automatiquement membre.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (facultatif)</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="min-h-20" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
