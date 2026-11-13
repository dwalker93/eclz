import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import LanguageDropdown from "@/components/blocks/dropdown-language"
import ProductInsightsCard from "@/components/blocks/widget-product-insights"
import ProfileDropdown from "@/components/blocks/dropdown-profile"
import SalesMetricsCard from "@/components/blocks/chart-sales-metrics"
import StatisticsCard from "@/components/blocks/statistics-card-01"
import TotalEarningCard from "@/components/blocks/widget-total-earning"
import TransactionDatatable, {
  type Item,
} from "@/components/blocks/datatable-transaction"

import FacebookIcon from "@/assets/svg/facebook-icon"
import InstagramIcon from "@/assets/svg/instagram-icon"
import LinkedinIcon from "@/assets/svg/linkedin-icon"
import TwitterIcon from "@/assets/svg/twitter-icon"
import {
  AwardIcon,
  BellRingIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarRangeIcon,
  CalendarX2Icon,
  ChartNoAxesCombinedIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileCheck2Icon,
  FileTextIcon,
  FolderOpenIcon,
  GraduationCapIcon,
  HandCoinsIcon,
  HeartHandshakeIcon,
  LandmarkIcon,
  LanguagesIcon,
  LayersIcon,
  LibraryBigIcon,
  ListChecksIcon,
  MapPinIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PercentIcon,
  PlugZapIcon,
  PresentationIcon,
  ReceiptIcon,
  ReceiptTextIcon,
  ScaleIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  TruckIcon,
} from "lucide-react"

// Statistics card data
const StatisticsCardData = [
  {
    icon: <TruckIcon className="size-4" />,
    value: "42",
    title: "Shipped Orders",
    changePercentage: "+18.2%",
  },
  {
    icon: <TriangleAlertIcon className="size-4" />,
    value: "8",
    title: "Damaged Returns",
    changePercentage: "-8.7%",
  },
  {
    icon: <CalendarX2Icon className="size-4" />,
    value: "27",
    title: "Missed Delivery Slots",
    changePercentage: "+4.3%",
  },
]

// Earning data for Total Earning card
const earningData = [
  {
    img: "https://cdn.shadcnstudio.com/ss-assets/blocks/dashboard-application/widgets/zipcar.png",
    platform: "Zipcar",
    technologies: "Vuejs & HTML",
    earnings: "-$23,569.26",
    progressPercentage: 75,
  },
  {
    img: "https://cdn.shadcnstudio.com/ss-assets/blocks/dashboard-application/widgets/bitbank.png",
    platform: "Bitbank",
    technologies: "Figma & React",
    earnings: "-$12,650.31",
    progressPercentage: 25,
  },
]

// Transaction table data
const transactionData: Item[] = [
  {
    id: "1",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-1.png",
    avatarFallback: "JA",
    name: "Jack Alfredo",
    amount: 316.0,
    status: "paid",
    email: "jack@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "2",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-2.png",
    avatarFallback: "MG",
    name: "Maria Gonzalez",
    amount: 253.4,
    status: "pending",
    email: "maria.g@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "3",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-3.png",
    avatarFallback: "JD",
    name: "John Doe",
    amount: 852.0,
    status: "paid",
    email: "john.doe@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "4",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-4.png",
    avatarFallback: "EC",
    name: "Emily Carter",
    amount: 889.0,
    status: "pending",
    email: "emily.carter@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "5",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-5.png",
    avatarFallback: "DL",
    name: "David Lee",
    amount: 723.16,
    status: "paid",
    email: "david.lee@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "6",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-6.png",
    avatarFallback: "SP",
    name: "Sophia Patel",
    amount: 612.0,
    status: "failed",
    email: "sophia.patel@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "7",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-7.png",
    avatarFallback: "RW",
    name: "Robert Wilson",
    amount: 445.25,
    status: "paid",
    email: "robert.wilson@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "8",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-8.png",
    avatarFallback: "LM",
    name: "Lisa Martinez",
    amount: 297.8,
    status: "processing",
    email: "lisa.martinez@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "9",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-9.png",
    avatarFallback: "MT",
    name: "Michael Thompson",
    amount: 756.9,
    status: "paid",
    email: "michael.thompson@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "10",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-10.png",
    avatarFallback: "AJ",
    name: "Amanda Johnson",
    amount: 189.5,
    status: "pending",
    email: "amanda.johnson@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "11",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-11.png",
    avatarFallback: "KB",
    name: "Kevin Brown",
    amount: 1024.75,
    status: "paid",
    email: "kevin.brown@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "12",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-12.png",
    avatarFallback: "SD",
    name: "Sarah Davis",
    amount: 367.2,
    status: "failed",
    email: "sarah.davis@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "13",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-13.png",
    avatarFallback: "CG",
    name: "Christopher Garcia",
    amount: 598.45,
    status: "processing",
    email: "christopher.garcia@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "14",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-14.png",
    avatarFallback: "JR",
    name: "Jennifer Rodriguez",
    amount: 821.3,
    status: "paid",
    email: "jennifer.rodriguez@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "15",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-15.png",
    avatarFallback: "DM",
    name: "Daniel Miller",
    amount: 156.75,
    status: "pending",
    email: "daniel.miller@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "16",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-16.png",
    avatarFallback: "NW",
    name: "Nicole White",
    amount: 934.1,
    status: "paid",
    email: "nicole.white@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "17",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-17.png",
    avatarFallback: "AL",
    name: "Anthony Lopez",
    amount: 412.85,
    status: "failed",
    email: "anthony.lopez@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "18",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-18.png",
    avatarFallback: "MH",
    name: "Michelle Harris",
    amount: 675.5,
    status: "processing",
    email: "michelle.harris@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "19",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-19.png",
    avatarFallback: "JC",
    name: "James Clark",
    amount: 289.95,
    status: "paid",
    email: "james.clark@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "20",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-20.png",
    avatarFallback: "RL",
    name: "Rachel Lewis",
    amount: 1156.25,
    status: "pending",
    email: "rachel.lewis@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "21",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-1.png",
    avatarFallback: "TY",
    name: "Thomas Young",
    amount: 543.6,
    status: "paid",
    email: "thomas.young@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "22",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-2.png",
    avatarFallback: "SB",
    name: "Stephanie Brown",
    amount: 789.3,
    status: "processing",
    email: "stephanie.brown@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "23",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-3.png",
    avatarFallback: "BM",
    name: "Brandon Moore",
    amount: 425.75,
    status: "failed",
    email: "brandon.moore@shadcnstudio.com",
    paidBy: "visa",
  },
  {
    id: "24",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-4.png",
    avatarFallback: "KT",
    name: "Kelly Taylor",
    amount: 1203.5,
    status: "paid",
    email: "kelly.taylor@shadcnstudio.com",
    paidBy: "mastercard",
  },
  {
    id: "25",
    avatar: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-5.png",
    avatarFallback: "MA",
    name: "Mark Anderson",
    amount: 356.2,
    status: "pending",
    email: "mark.anderson@shadcnstudio.com",
    paidBy: "visa",
  },
]

const DashboardShell = () => {
  return (
    <div className="flex min-h-dvh w-full">
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <ChartNoAxesCombinedIcon />
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="top-1/2! right-2 -translate-y-1/2! rounded-full bg-primary/10">
                      5
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>People</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <GraduationCapIcon />
                      <span>Students</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <PresentationIcon />
                      <span>Lecturers</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <HeartHandshakeIcon />
                      <span>Guardians</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <TrendingUpIcon />
                      <span>Promotions</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Academics</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <BookOpenIcon />
                      <span>Courses &amp; Classes</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <LibraryBigIcon />
                      <span>Subjects</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <CalendarRangeIcon />
                      <span>Terms &amp; Intakes</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <LayersIcon />
                      <span>Grade Levels</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <CalendarClockIcon />
                      <span>Timetable</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <ClipboardCheckIcon />
                      <span>Attendance</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Finance</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <ReceiptTextIcon />
                      <span>Fee Structures</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <FileTextIcon />
                      <span>Invoices</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <CreditCardIcon />
                      <span>Payments</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="top-1/2! right-2 -translate-y-1/2! rounded-full bg-primary/10">
                      7
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <ReceiptIcon />
                      <span>Receipts</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <PercentIcon />
                      <span>Fee Exceptions</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <LandmarkIcon />
                      <span>Payment Methods</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Exams</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <FileCheck2Icon />
                      <span>Exams</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <ListChecksIcon />
                      <span>Question Bank</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <AwardIcon />
                      <span>Results</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Content Store</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <FolderOpenIcon />
                      <span>Content Library</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <ShoppingCartIcon />
                      <span>Purchases</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Communication</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <MegaphoneIcon />
                      <span>Notices</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <MessageSquareIcon />
                      <span>Messages</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <BellRingIcon />
                      <span>Notifications</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Commissions</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <ScaleIcon />
                      <span>Commission Rules</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <HandCoinsIcon />
                      <span>Teacher Payouts</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <Building2Icon />
                      <span>Organization</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <MapPinIcon />
                      <span>Branches</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <ShieldCheckIcon />
                      <span>Users &amp; Roles</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <ScrollTextIcon />
                      <span>Audit Log</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#" />}>
                      <PlugZapIcon />
                      <span>Integrations</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-50 border-b bg-card">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-2 sm:px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="[&_svg]:size-5!" />
                <Separator
                  orientation="vertical"
                  className="hidden h-4! sm:block data-vertical:self-center"
                />
                <Breadcrumb className="hidden sm:block">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">Home</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Free</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className="flex items-center gap-1.5">
                <LanguageDropdown
                  trigger={
                    <Button variant="ghost" size="icon-lg">
                      <LanguagesIcon />
                    </Button>
                  }
                />
                <ProfileDropdown
                  trigger={
                    <Button variant="ghost" size="icon-lg">
                      <Avatar className="size-[inherit] rounded-[inherit] after:rounded-[inherit]">
                        <AvatarImage
                          src="https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-1.png"
                          className="rounded-[inherit]"
                        />
                        <AvatarFallback className="rounded-[inherit]">
                          JD
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  }
                />
              </div>
            </div>
          </header>
          <main className="mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
              {/* Statistics Cards */}
              <div className="col-span-full grid gap-6 sm:grid-cols-3 md:max-lg:grid-cols-1">
                {StatisticsCardData.map((card, index) => (
                  <StatisticsCard
                    key={index}
                    icon={card.icon}
                    title={card.title}
                    value={card.value}
                    changePercentage={card.changePercentage}
                  />
                ))}
              </div>

              <div className="grid gap-6 max-xl:col-span-full lg:max-xl:grid-cols-2">
                {/* Product Insights Card */}
                <ProductInsightsCard className="justify-between gap-3 *:data-[slot=card-content]:space-y-5" />

                {/* Total Earning Card */}
                <TotalEarningCard
                  title="Total Earning"
                  earning={24650}
                  trend="up"
                  percentage={10}
                  comparisonText="Compare to last year ($84,325)"
                  earningData={earningData}
                  className="justify-between gap-5 sm:min-w-0"
                />
              </div>

              <SalesMetricsCard className="col-span-full *:data-[slot=card-content]:space-y-6 xl:col-span-2" />

              <Card className="col-span-full w-full py-0">
                <TransactionDatatable data={transactionData} />
              </Card>
            </div>
          </main>
          <footer>
            <div className="mx-auto flex size-full max-w-7xl items-center justify-between gap-3 px-4 py-3 text-muted-foreground max-sm:flex-col sm:gap-6 sm:px-6">
              <p className="text-sm text-balance max-sm:text-center">
                {`©${new Date().getFullYear()}`}{" "}
                <a href="#" className="text-primary">
                  shadcn/studio
                </a>
                , Made for better web design
              </p>
              <div className="flex items-center gap-5 text-muted-foreground *:hover:text-primary">
                <a href="#">
                  <FacebookIcon className="size-4" />
                </a>
                <a href="#">
                  <InstagramIcon className="size-4" />
                </a>
                <a href="#">
                  <LinkedinIcon className="size-4" />
                </a>
                <a href="#">
                  <TwitterIcon className="size-4" />
                </a>
              </div>
            </div>
          </footer>
        </div>
      </SidebarProvider>
    </div>
  )
}

export default DashboardShell
