<?php
/**
 * Single entry fallback template (PLAN.md §4.2 & §8).
 * Renders a clean, accessible, styled no-JS view of the glossary entry
 * with an "Open in the 3D map" link back to #/e/<slug>.
 */

if ( have_posts() ) : while ( have_posts() ) : the_post();
    $acf = function_exists('get_fields') ? get_fields() : [];
    $german = $acf['german'] ?? '';
    $english = $acf['english'] ?? '';
    $arabic = $acf['arabic'] ?? '';
    $author = $acf['author'] ?? '';
    $slug = $post->post_name;
    $map_url = home_url( '/#/e/' . $slug );
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php the_title(); ?> — Al-Khatib-Glossar</title>
    <link rel="stylesheet" href="<?php echo get_stylesheet_directory_uri(); ?>/assets/index.css">
    <style>
        body {
            background: #0b0c10;
            color: #ece7da;
            margin: 0;
            padding: 24px 16px;
            font-family: Georgia, serif;
        }
        .single-entry-container {
            max-width: 720px;
            margin: 40px auto;
            padding: 32px;
            background: rgba(20, 22, 29, 0.9);
            border: 1px solid #23262f;
            border-radius: 2px;
        }
        .map-link-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: #27348b;
            color: #ece7da;
            text-decoration: none;
            font-family: monospace;
            font-size: 0.85rem;
            border-radius: 2px;
            margin-bottom: 24px;
            transition: opacity 0.2s;
        }
        .map-link-chip:hover {
            opacity: 0.85;
        }
        .entry-display-title {
            font-family: "favorit", sans-serif;
            font-size: clamp(2rem, 3.5vw, 2.8rem);
            margin: 0 0 8px 0;
            color: #ece7da;
            line-height: 1.1;
        }
        .entry-credits-line {
            font-family: monospace;
            font-size: 0.85rem;
            color: #a8a497;
            margin-bottom: 24px;
        }
        .entry-body-section {
            margin-top: 28px;
            line-height: 1.7;
            font-size: 1.05rem;
            color: #ece7da;
        }
        .entry-body-section[dir="rtl"] {
            line-height: 1.9;
        }
        .lang-heading {
            font-family: monospace;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6c6a63;
            border-bottom: 1px solid #23262f;
            padding-bottom: 6px;
            margin: 28px 0 16px 0;
        }
    </style>
</head>
<body>
    <article class="single-entry-container">
        <a href="<?php echo esc_url( $map_url ); ?>" class="map-link-chip">↜ Im 3D-Glossar öffnen / Open in 3D Map</a>
        
        <?php if ( has_post_thumbnail() ) : ?>
            <div style="margin-bottom: 20px;">
                <?php the_post_thumbnail( 'medium', [ 'style' => 'max-height: 80px; width: auto; filter: invert(39%) sepia(87%) saturate(2284%) hue-rotate(338deg);' ] ); ?>
            </div>
        <?php endif; ?>

        <h1 class="entry-display-title"><?php the_title(); ?></h1>
        
        <?php if ( ! empty( $author ) ) : ?>
            <div class="entry-credits-line"><?php echo esc_html( $author ); ?></div>
        <?php endif; ?>

        <?php if ( ! empty( $german ) ) : ?>
            <section class="entry-body-section">
                <div class="lang-heading">Deutsch</div>
                <?php echo wp_kses_post( $german ); ?>
            </section>
        <?php endif; ?>

        <?php if ( ! empty( $english ) ) : ?>
            <section class="entry-body-section">
                <div class="lang-heading">English</div>
                <?php echo wp_kses_post( $english ); ?>
            </section>
        <?php endif; ?>

        <?php if ( ! empty( $arabic ) ) : ?>
            <section class="entry-body-section" dir="rtl">
                <div class="lang-heading">عربي</div>
                <?php echo wp_kses_post( $arabic ); ?>
            </section>
        <?php endif; ?>
    </article>
</body>
</html>
<?php endwhile; endif; ?>
