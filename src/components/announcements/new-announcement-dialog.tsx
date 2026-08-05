"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CircleAlertIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { createAnnouncementAction } from "@/app/actions/announcements"
import {
  createAnnouncementSchema,
  type CreateAnnouncementInput,
} from "@/lib/announcements/schemas"
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

// Dialog de création d'une annonce (/annonces), réservé aux détenteurs de
// `announcement:manage` — le bouton qui l'ouvre n'est rendu que côté page
// pour ces utilisateurs, la vérification qui fait autorité reste dans
// createAnnouncementAction.
type NewAnnouncementDialogProps = {
  // "icon" : petit bouton "+" sans texte, utilisé dans le rail droit de
  // /fil (espace restreint) — "button" (défaut) : bouton complet.
  trigger?: "button" | "icon"
}

export function NewAnnouncementDialog({ trigger = "button" }: NewAnnouncementDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const form = useForm<CreateAnnouncementInput>({
    resolver: zodResolver(createAnnouncementSchema),
    defaultValues: { title: "", body: "" },
  })

  async function onSubmit(values: CreateAnnouncementInput) {
    setIsPending(true)
    setError(null)
    try {
      const result = await createAnnouncementAction(values)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("L'annonce a été publiée.")
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
            <Button variant="ghost" size="icon" className="size-6" aria-label="Nouvelle annonce">
              <PlusIcon className="size-4" />
            </Button>
          ) : (
            <Button>
              <PlusIcon className="size-4" />
              Nouvelle annonce
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle annonce</DialogTitle>
          <DialogDescription>
            Elle apparaîtra en tête de liste et pourra être épinglée.
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contenu</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="min-h-32" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                Publier
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
