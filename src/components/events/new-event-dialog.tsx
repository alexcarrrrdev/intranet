"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { CircleAlertIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { createEventAction } from "@/app/actions/events"
import { createEventSchema } from "@/lib/events/schemas"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

// Valeurs par défaut du formulaire : chaînes vides pour les champs texte,
// `startsAt`/`endsAt` restent des chaînes (voir `<input type="datetime-local">`
// ci-dessous) jusqu'à la validation zod (createEventSchema, z.coerce.date).
type FormValues = {
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: string
  allDay: boolean
}

// Dialog de création d'un événement (/calendrier), réservé aux détenteurs
// de `event:manage` — le bouton qui l'ouvre n'est rendu que côté page pour
// ces utilisateurs, la vérification qui fait autorité reste dans
// createEventAction.
export function NewEventDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const form = useForm<FormValues>({
    defaultValues: {
      title: "",
      description: "",
      location: "",
      startsAt: "",
      endsAt: "",
      allDay: false,
    },
  })
  // Doublon volontaire de `form`'s `allDay` (plutôt que `form.watch`, dont
  // le lint react-hooks/incompatible-library du React Compiler signale
  // qu'il n'est pas mémoïsable) : ne sert qu'à adapter le type des champs
  // date ci-dessous (`date` vs `datetime-local`).
  const [allDay, setAllDay] = useState(false)

  async function onSubmit(values: FormValues) {
    setError(null)

    const parsed = createEventSchema.safeParse({
      title: values.title,
      description: values.description || undefined,
      location: values.location || undefined,
      startsAt: values.startsAt,
      endsAt: values.endsAt || undefined,
      allDay: values.allDay,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Événement invalide.")
      return
    }

    setIsPending(true)
    try {
      const result = await createEventAction(parsed.data)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("L'événement a été créé.")
      form.reset()
      setAllDay(false)
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
      setAllDay(false)
          setError(null)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <PlusIcon className="size-4" />
            Nouvel événement
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvel événement</DialogTitle>
          <DialogDescription>
            Il apparaîtra dans la liste des événements à venir.
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
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lieu (facultatif)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allDay"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true)
                        setAllDay(checked === true)
                      }}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Toute la journée</FormLabel>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Début</FormLabel>
                    <FormControl>
                      <Input
                        type={allDay ? "date" : "datetime-local"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fin (facultatif)</FormLabel>
                    <FormControl>
                      <Input
                        type={allDay ? "date" : "datetime-local"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
