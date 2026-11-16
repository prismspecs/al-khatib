<?php /* Template Name: Map */ ?>
<!DOCTYPE html>
<html lang="en">

<head>
    <?php wp_head(); ?>

    <meta charset="utf-8" />
    <title>Al-Khatib-Glossar</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="description" content="Al-Khatib-Glossar: Ein mehrsprachiges Projekt des Kollektivs Wiese zum Al-Khatib-Verfahren in Koblenz." />
    
    <!-- Open Graph / Meta -->
    <meta property="og:title" content="Al-Khatib-Glossar" />
    <meta property="og:description" content="Ein mehrsprachiges Projekt des Kollektivs Wiese zum Al-Khatib-Verfahren in Koblenz." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="<?php echo esc_url( home_url( '/' ) ); ?>" />

    <!-- Asset Preloads -->
    <link rel="preload" href="<?php echo get_stylesheet_directory_uri(); ?>/assets/04c4a36facccf2d0906a0f1ed61036ef.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="<?php echo get_stylesheet_directory_uri(); ?>/assets/newsreader-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="<?php echo get_stylesheet_directory_uri(); ?>/assets/ibm-plex-mono-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="<?php echo get_stylesheet_directory_uri(); ?>/map-assets/relief_proxy.opt.glb" as="fetch" crossorigin>

    <link rel="stylesheet" type="text/css" href="<?php echo get_stylesheet_directory_uri(); ?>/assets/index.css?v=<?php echo file_exists(get_stylesheet_directory() . '/assets/index.css') ? filemtime(get_stylesheet_directory() . '/assets/index.css') : '1'; ?>">
</head>

<body>
    <!-- Grain overlay -->
    <div id="grain-overlay"></div>
    <div id="ui-root"></div>

    <script src="<?php echo get_stylesheet_directory_uri(); ?>/config.js"></script>
    <script>
        window.AKG = window.AKG || {};
        window.AKG.themeBase = "<?php echo get_stylesheet_directory_uri(); ?>/";
        window.AKG.apiBase = "<?php echo esc_url(home_url('/')); ?>";
    </script>
    <script type="module" src="<?php echo get_stylesheet_directory_uri(); ?>/assets/index.js?v=<?php echo file_exists(get_stylesheet_directory() . '/assets/index.js') ? filemtime(get_stylesheet_directory() . '/assets/index.js') : '1'; ?>"></script>

    <!-- Crawlable Navigation & No-JS Fallback (PLAN.md §4.2 & §8) -->
    <noscript>
        <div style="padding: 40px 20px; max-width: 800px; margin: 0 auto; color: #ece7da; background: #0b0c10; font-family: sans-serif;">
            <h1>Al-Khatib-Glossar</h1>
            <p>Für die interaktive 3D-Karte aktivieren Sie bitte JavaScript in Ihrem Browser.</p>
            <p>For the interactive 3D map, please enable JavaScript in your browser.</p>
            <hr style="border: 0; height: 1px; background: #23262f; margin: 24px 0;" />
            <h2>Glossar-Einträge / Glossary Entries:</h2>
            <ul>
                <?php
                $posts = get_posts([
                    'category' => 2,
                    'numberposts' => -1,
                    'orderby' => 'title',
                    'order' => 'ASC'
                ]);
                foreach ( $posts as $p ) :
                ?>
                    <li>
                        <a href="<?php echo get_permalink($p->ID); ?>" style="color: #ff4a3d; text-decoration: none;">
                            <?php echo esc_html($p->post_title); ?>
                        </a>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
    </noscript>

    <nav class="sr-only" style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0;" aria-label="Index of glossary entries">
        <ul>
            <?php
            if ( isset($posts) && is_array($posts) ) {
                foreach ( $posts as $p ) {
                    echo '<li><a href="' . esc_url( get_permalink($p->ID) ) . '">' . esc_html($p->post_title) . '</a></li>';
                }
            }
            ?>
        </ul>
    </nav>

    <?php wp_footer(); ?>
</body>

</html>
