import FacebookIcon from "@/assets/svg/facebook-icon"
import InstagramIcon from "@/assets/svg/instagram-icon"
import LinkedinIcon from "@/assets/svg/linkedin-icon"
import TwitterIcon from "@/assets/svg/twitter-icon"

const socialLinks = [
  { label: "Facebook", href: "#", icon: FacebookIcon },
  { label: "Instagram", href: "#", icon: InstagramIcon },
  { label: "LinkedIn", href: "#", icon: LinkedinIcon },
  { label: "Twitter", href: "#", icon: TwitterIcon },
]

export function AppFooter() {
  return (
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
          {socialLinks.map(({ label, href, icon: Icon }) => (
            <a key={label} href={href} aria-label={label}>
              <Icon className="size-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
