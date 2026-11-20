import { site } from "@/config/site";

export default function Home() {
  return (
    <div className="shell">
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <h1 id="hero-title">AI news at your pace.</h1>
          <p className="tagline">{site.tagline}</p>
          <a className="btn-memphis" href="#about">Meet the deck <span aria-hidden="true">↓</span></a>
        </div>
        <div className="deck-illustration">
          <figure className="card-memphis robot-card">
            <div className="robot" aria-hidden="true">
              <div className="antenna" />
              <div className="robot-head">
                <div className="robot-eyes"><span /><span /></div>
                <div className="robot-mouth" />
              </div>
              <div className="robot-body">
                <div className="robot-panel"><span /><span /><span /></div>
              </div>
              <div className="robot-feet"><span /><span /></div>
            </div>
            <figcaption>I read the AI news. You finish your tea.</figcaption>
          </figure>
        </div>
      </section>
      <section id="about" className="card-memphis about" aria-labelledby="about-title">
        <h2 id="about-title">About the deck</h2>
        <p>One story at a time, with a short summary and a link to the original.</p>
      </section>
    </div>
  );
}
