import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { catalogsApi } from "@/api/catalogs";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { BookOpen, ArrowRight } from "lucide-react";

export default function CatalogsPage() {
  const { data: catalogs, isLoading } = useQuery({
    queryKey: ["catalogs"],
    queryFn: () => catalogsApi.list(),
  });

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <PageHeader title="Каталоги продукции" description="Просматривайте подобранные коллекции кухонных шкафов премиум-класса" />
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : catalogs?.length === 0 ? (
        <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-border/60">
          <p className="text-muted-foreground">Каталоги отсутствуют</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {catalogs?.map((catalog, i) => (
            <Link key={catalog.id} to={`/catalogs/${catalog.id}/categories`}>
              <Card className="group animate-fade-up overflow-hidden border-border/60 transition-all duration-300 hover:border-primary/30 hover:shadow-md" style={{ animationDelay: `${(i + 1) * 80}ms` }}>
                {catalog.preview_img ? (
                  <div className="h-36 overflow-hidden bg-muted">
                    <img
                      src={catalog.preview_img}
                      alt={catalog.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="flex h-36 items-center justify-center bg-muted/50">
                    <BookOpen className="h-10 w-10 text-muted-foreground/25" />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{catalog.name}</CardTitle>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
